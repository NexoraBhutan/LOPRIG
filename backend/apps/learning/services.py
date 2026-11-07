from dataclasses import dataclass
from datetime import date, timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotAuthenticated, PermissionDenied

from apps.certificates.models import Certificate
from apps.certificates.services import issue_certificate
from apps.courses.models import Course, Lesson, Quiz, QuizQuestion
from apps.enrollments.models import Enrollment
from apps.enrollments.services import enroll_free, get_access_enrollment
from apps.notifications.models import Notification
from apps.notifications.services import notify

from .models import ActivityDay, LessonProgress, QuizAttempt

XP_PER_LESSON = 10
XP_PER_COURSE = 100


@dataclass
class CourseProgress:
    """Finishing a course = every lesson completed and every chapter quiz passed."""

    completed_lessons: int
    total_lessons: int
    passed_quizzes: int = 0
    total_quizzes: int = 0

    @property
    def percent(self) -> int:
        total = self.total_lessons + self.total_quizzes
        return round(100 * (self.completed_lessons + self.passed_quizzes) / total) if total else 0

    @property
    def finished(self) -> bool:
        return (self.total_lessons > 0 and self.completed_lessons >= self.total_lessons
                and self.passed_quizzes >= self.total_quizzes)

    def as_dict(self) -> dict:
        return {
            "completed_lessons": self.completed_lessons,
            "total_lessons": self.total_lessons,
            "passed_quizzes": self.passed_quizzes,
            "total_quizzes": self.total_quizzes,
            "percent": self.percent,
        }


def is_open_course(course: Course) -> bool:
    """Free, admin-approved courses: anyone can watch every lesson, no enrollment or login needed."""
    return course.status == Course.Status.PUBLISHED and course.is_free


def require_access(student, course: Course) -> Enrollment:
    enrollment = get_access_enrollment(student, course)
    if enrollment is None and is_open_course(course):
        # Students on a free course are enrolled quietly, so progress and the certificate still work.
        enrollment, _ = enroll_free(student, course)
    if enrollment is None:
        raise PermissionDenied("Enroll in this course to access its lessons.")
    return enrollment


def check_lesson_access(user, lesson: Lesson) -> Enrollment | None:
    """Free published courses and preview lessons are open to everyone; the rest needs an enrollment."""
    course = lesson.module.course
    if is_open_course(course):
        return require_access(user, course) if user.is_authenticated and user.is_student else None
    if lesson.is_preview and course.status == Course.Status.PUBLISHED:
        if user.is_authenticated and user.is_student:
            return get_access_enrollment(user, course)
        return None
    if not user.is_authenticated:
        raise NotAuthenticated()
    if not user.is_student:
        raise PermissionDenied("Only student accounts can access lessons.")
    return require_access(user, course)


def course_progress(enrollment: Enrollment) -> CourseProgress:
    total = Lesson.objects.filter(module__course_id=enrollment.course_id).count()
    done = LessonProgress.objects.filter(
        enrollment=enrollment, completed=True, lesson__module__course_id=enrollment.course_id
    ).count()
    quizzes = course_quizzes(enrollment.course_id)
    passed = (QuizAttempt.objects.filter(enrollment=enrollment, passed=True, quiz__in=quizzes)
              .values("quiz").distinct().count())
    return CourseProgress(completed_lessons=done, total_lessons=total,
                          passed_quizzes=passed, total_quizzes=quizzes.count())


def course_quizzes(course_id):
    """Chapter quizzes that count: only ones with at least one question."""
    return Quiz.objects.filter(module__course_id=course_id, questions__isnull=False).distinct()


@transaction.atomic
def record_progress(student, lesson: Lesson, position_seconds: int | None = None, completed: bool = False):
    """Save a resume position and/or mark a lesson complete. Completion is one-way.

    Returns (lesson_progress, course_progress, certificate_or_None).
    """
    enrollment = require_access(student, lesson.module.course)
    enrollment = Enrollment.objects.select_for_update().get(pk=enrollment.pk)

    progress, _ = LessonProgress.objects.get_or_create(enrollment=enrollment, lesson=lesson)
    if position_seconds is not None:
        cap = lesson.duration_seconds or position_seconds
        progress.position_seconds = max(0, min(position_seconds, cap))
    newly_completed = completed and not progress.completed
    if newly_completed:
        progress.completed = True
        progress.completed_at = timezone.now()
    progress.save()

    enrollment.last_lesson = lesson
    enrollment.save(update_fields=["last_lesson", "updated_at"])
    ActivityDay.objects.get_or_create(student=student, day=timezone.localdate())

    certificate = complete_course_if_done(enrollment) if newly_completed else None
    return progress, course_progress(enrollment), certificate


WRITTEN_ANSWER_MAX = 5000


def _clean_answer(question: dict, answer):
    """A choice answer is a valid option index or None; a written answer is trimmed text."""
    if question["kind"] == QuizQuestion.Kind.WRITTEN:
        return answer.strip()[:WRITTEN_ANSWER_MAX] if isinstance(answer, str) else ""
    if isinstance(answer, int) and not isinstance(answer, bool) and 0 <= answer < len(question["options"]):
        return answer
    return None


def _choice_correct(question: dict, answer) -> bool:
    return question["kind"] != QuizQuestion.Kind.WRITTEN and answer is not None and answer == question["correct"]


@transaction.atomic
def submit_quiz(student, quiz: Quiz, answers: list):
    """Grade a chapter quiz attempt. Passing the last requirement completes the course.

    Multiple-choice questions are marked right away. If the quiz has written questions the attempt
    waits for the teacher (PENDING, no score) and the teacher is told. A student can't send another
    attempt while one is waiting.

    Returns (attempt, course_progress, certificate_or_None).
    """
    from rest_framework.exceptions import ValidationError

    enrollment = require_access(student, quiz.module.course)
    enrollment = Enrollment.objects.select_for_update().get(pk=enrollment.pk)
    questions = [q.snapshot() for q in quiz.questions.all()]
    if not questions:
        raise ValidationError({"answers": "This quiz has no questions yet."})
    if QuizAttempt.objects.filter(enrollment=enrollment, quiz=quiz, status=QuizAttempt.Status.PENDING).exists():
        raise ValidationError({"answers": "Your last answers are still waiting for your teacher's review."})

    given = [_clean_answer(q, answers[i] if i < len(answers) else None) for i, q in enumerate(questions)]
    attempt = QuizAttempt(enrollment=enrollment, quiz=quiz, answers=given, questions=questions)
    if any(q["kind"] == QuizQuestion.Kind.WRITTEN for q in questions):
        attempt.status = QuizAttempt.Status.PENDING
    else:
        attempt.score = round(100 * sum(_choice_correct(q, a) for q, a in zip(questions, given)) / len(questions))
        attempt.passed = attempt.score >= quiz.pass_percent
    attempt.save()
    ActivityDay.objects.get_or_create(student=student, day=timezone.localdate())

    if attempt.status == QuizAttempt.Status.PENDING:
        _tell_teacher_to_review(attempt)
    certificate = complete_course_if_done(enrollment) if attempt.passed else None
    return attempt, course_progress(enrollment), certificate


def _tell_teacher_to_review(attempt: QuizAttempt):
    course = attempt.quiz.module.course
    student = attempt.enrollment.student
    name = student.get_full_name() or student.email
    notify(
        course.teacher,
        Notification.Kind.SYSTEM,
        f"New answers to review: {attempt.quiz.title}",
        f"{name} sent written answers in {course.title}.",
        data={"review": attempt.id, "course": course.slug},
        email=True,
        email_body=[
            f"{name} has just finished “{attempt.quiz.title}” in your course “{course.title}” "
            "and is waiting for you to mark their written answers.",
            "It only takes a minute: mark each answer and add a few words of feedback. "
            "Students can't move past this chapter test until it's reviewed.",
        ],
        email_button=("Review answers", f"{settings.FRONTEND_URL.rstrip('/')}/teach/reviews/{attempt.id}"),
    )


@transaction.atomic
def review_attempt(reviewer, attempt: QuizAttempt, marks: dict, feedback: str = ""):
    """The teacher marks every written answer; the attempt gets its score and may complete the course.

    `marks` maps question id -> {"correct": bool, "feedback": str}. Returns (attempt, certificate_or_None).
    """
    from rest_framework.exceptions import ValidationError

    attempt = QuizAttempt.objects.select_for_update().select_related(
        "quiz__module__course", "enrollment__student").get(pk=attempt.pk)
    if attempt.status != QuizAttempt.Status.PENDING:
        raise ValidationError({"detail": "These answers have already been reviewed."})
    written = [q for q in attempt.questions if q["kind"] == QuizQuestion.Kind.WRITTEN]
    if any(q["id"] not in marks for q in written):
        raise ValidationError({"marks": "Mark every written answer as correct or not."})

    attempt.marks = {str(q["id"]): marks[q["id"]] for q in written}
    correct = sum(
        attempt.marks[str(q["id"])]["correct"] if q["kind"] == QuizQuestion.Kind.WRITTEN else _choice_correct(q, a)
        for q, a in zip(attempt.questions, attempt.answers)
    )
    attempt.score = round(100 * correct / len(attempt.questions))
    attempt.passed = attempt.score >= attempt.quiz.pass_percent
    attempt.status = QuizAttempt.Status.REVIEWED
    attempt.feedback = feedback
    attempt.reviewed_by = reviewer
    attempt.reviewed_at = timezone.now()
    attempt.save()

    enrollment = Enrollment.objects.select_for_update().get(pk=attempt.enrollment_id)
    certificate = complete_course_if_done(enrollment) if attempt.passed else None

    course = attempt.quiz.module.course
    link = f"{settings.FRONTEND_URL.rstrip('/')}/learn/{course.slug}?quiz={attempt.quiz_id}"
    outcome = (f"You passed with {attempt.score}%. Well done!" if attempt.passed
               else f"You scored {attempt.score}% and need {attempt.quiz.pass_percent}% to pass. "
                    "Read the feedback and give it another go.")
    notify(
        enrollment.student,
        Notification.Kind.SYSTEM,
        f"Your answers were reviewed: {attempt.quiz.title}",
        outcome,
        data={"course": course.slug, "quiz": attempt.quiz_id},
        email=True,
        email_body=[
            f"Your teacher has reviewed your answers to “{attempt.quiz.title}” in “{course.title}”.",
            outcome,
            *([f"Your teacher's note: “{feedback}”"] if feedback else []),
        ],
        email_button=("See your feedback", link),
    )
    return attempt, certificate


def attempt_payload(attempt: QuizAttempt) -> dict:
    """An attempt as the student sees it: their answers, what was right, and the teacher's feedback.

    While waiting for review, written answers have no verdict and the model answers stay hidden.
    """
    reviewed = attempt.status != QuizAttempt.Status.PENDING
    results = []
    for q, a in zip(attempt.questions, attempt.answers):
        if q["kind"] == QuizQuestion.Kind.WRITTEN:
            mark = attempt.marks.get(str(q["id"]), {})
            results.append({
                "question": q["id"], "kind": q["kind"], "text": a or "",
                "is_correct": mark.get("correct") if reviewed else None,
                "feedback": mark.get("feedback", "") if reviewed else "",
                "model_answer": q["model_answer"] if reviewed else "",
                "explanation": q["explanation"] if reviewed else "",
            })
        else:
            results.append({
                "question": q["id"], "kind": q["kind"], "chosen": a, "correct": q["correct"],
                "is_correct": _choice_correct(q, a), "explanation": q["explanation"],
            })
    return {
        "id": attempt.id,
        "status": attempt.status,
        "score": attempt.score,
        "passed": attempt.passed,
        "correct_count": sum(bool(r["is_correct"]) for r in results),
        "total": len(results),
        "pass_percent": attempt.quiz.pass_percent,
        "questions": [{"id": q["id"], "kind": q["kind"], "prompt": q["prompt"], "options": q["options"]}
                      for q in attempt.questions],
        "results": results,
        "feedback": attempt.feedback,
        "reviewed_at": attempt.reviewed_at,
        "submitted_at": attempt.created_at,
    }


def quiz_results(enrollment) -> dict:
    """quiz id -> {"best_score", "passed", "attempts", "pending"} for one enrollment."""
    results: dict[int, dict] = {}
    if enrollment is None:
        return results
    for a in QuizAttempt.objects.filter(enrollment=enrollment).only("quiz_id", "score", "passed", "status"):
        r = results.setdefault(a.quiz_id, {"best_score": None, "passed": False, "attempts": 0, "pending": False})
        if a.score is not None:
            r["best_score"] = max(r["best_score"] or 0, a.score)
        r["passed"] = r["passed"] or a.passed
        r["pending"] = r["pending"] or a.status == QuizAttempt.Status.PENDING
        r["attempts"] += 1
    return results


def complete_course_if_done(enrollment: Enrollment) -> Certificate | None:
    if not course_progress(enrollment).finished:
        return None
    just_completed = enrollment.status != Enrollment.Status.COMPLETED
    if just_completed:
        enrollment.status = Enrollment.Status.COMPLETED
        enrollment.completed_at = timezone.now()
        enrollment.save(update_fields=["status", "completed_at", "updated_at"])
    certificate, _ = issue_certificate(enrollment)
    if just_completed:
        course = enrollment.course
        notify(
            enrollment.student,
            Notification.Kind.COURSE_COMPLETED,
            f"You completed {course.title}!",
            f"Congratulations. Your certificate code is {certificate.code}.",
            data={"course": course.slug, "certificate": certificate.code},
            email=True,
            email_body=[
                f"Congratulations! You've completed every lesson in “{course.title}”. 🏆 "
                "We're truly proud of your hard work and dedication.",
                f"Your certificate is ready. Certificate code: {certificate.code}",
                "Keep that curiosity going: your next course is waiting whenever you are. "
                "Thank you for learning with Lop-rig!",
            ],
            email_button=("View your certificate", f"{settings.FRONTEND_URL.rstrip('/')}/certificates/{certificate.code}"),
        )
    return certificate


def day_streak(student, today: date | None = None) -> int:
    """Consecutive learning days ending today (or yesterday, so the streak survives until midnight)."""
    today = today or timezone.localdate()
    days = set(
        ActivityDay.objects.filter(student=student, day__gte=today - timedelta(days=366)).values_list("day", flat=True)
    )
    cursor = today if today in days else today - timedelta(days=1)
    streak = 0
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def learning_summary(student) -> dict:
    enrollments = Enrollment.objects.filter(student=student, status__in=Enrollment.ACCESS_STATUSES)
    completed_courses = enrollments.filter(status=Enrollment.Status.COMPLETED).count()
    completed_lessons = LessonProgress.objects.filter(enrollment__in=enrollments, completed=True).count()
    return {
        "enrolled_courses": enrollments.count(),
        "completed_courses": completed_courses,
        "completed_lessons": completed_lessons,
        "certificates": Certificate.objects.filter(student=student).count(),
        "streak": day_streak(student),
        "xp": completed_lessons * XP_PER_LESSON + completed_courses * XP_PER_COURSE,
    }
