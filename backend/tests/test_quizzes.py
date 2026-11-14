from rest_framework.test import APITestCase

from apps.certificates.models import Certificate
from apps.courses.models import CourseModule
from apps.enrollments.models import Enrollment

from .factories import lessons_of, make_admin, make_course, make_teacher, make_user

QUIZ = {
    "title": "Chapter 1 check",
    "pass_percent": 50,
    "questions": [
        {"prompt": "2 + 2 = ?", "options": ["3", "4", "5"], "correct": 1, "explanation": "Two pairs make four."},
        {"prompt": "Python is a…", "options": ["Snake only", "Programming language"], "correct": 1},
    ],
}


class TeacherQuizTests(APITestCase):
    def setUp(self):
        self.teacher = make_teacher()
        self.course = make_course("quiz-course", price="500", teacher=self.teacher, lessons=2)
        self.module = CourseModule.objects.get(course=self.course)
        self.url = f"/api/v1/teach/modules/{self.module.id}/quiz/"
        self.client.force_authenticate(self.teacher)

    def test_save_and_read_back(self):
        empty = self.client.get(self.url).data
        self.assertIsNone(empty["id"])
        self.assertEqual(empty["questions"], [])

        res = self.client.put(self.url, QUIZ, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(len(res.data["questions"]), 2)
        self.assertEqual(res.data["questions"][0]["correct"], 1)

        course = self.client.get(f"/api/v1/teach/courses/{self.course.slug}/").data
        self.assertEqual(course["modules"][0]["quiz"]["questions_count"], 2)

    def test_validation(self):
        bad_correct = {**QUIZ, "questions": [{"prompt": "Q", "options": ["a", "b"], "correct": 5}]}
        self.assertEqual(self.client.put(self.url, bad_correct, format="json").status_code, 400)
        one_option = {**QUIZ, "questions": [{"prompt": "Q", "options": ["only"], "correct": 0}]}
        self.assertEqual(self.client.put(self.url, one_option, format="json").status_code, 400)
        self.assertEqual(self.client.put(self.url, {**QUIZ, "questions": []}, format="json").status_code, 400)

    def test_other_teachers_cannot_touch_it(self):
        self.client.force_authenticate(make_teacher(email="other@example.com"))
        self.assertEqual(self.client.put(self.url, QUIZ, format="json").status_code, 404)


class StudentQuizTests(APITestCase):
    def setUp(self):
        self.teacher = make_teacher()
        self.course = make_course("quiz-course", price="500", teacher=self.teacher, lessons=2)
        self.course.what_you_learn = ["Add numbers", "Write Python"]
        self.course.save()
        module = CourseModule.objects.get(course=self.course)
        self.client.force_authenticate(self.teacher)
        self.quiz_id = self.client.put(f"/api/v1/teach/modules/{module.id}/quiz/", QUIZ, format="json").data["id"]
        self.student = make_user()
        self.enrollment = Enrollment.objects.create(student=self.student, course=self.course,
                                                    status=Enrollment.Status.ACTIVE)
        self.client.force_authenticate(self.student)

    def finish_lessons(self):
        for lesson in lessons_of(self.course):
            self.client.post(f"/api/v1/learning/lessons/{lesson.id}/progress/", {"completed": True}, format="json")

    def attempt(self, answers):
        return self.client.post(f"/api/v1/learning/quizzes/{self.quiz_id}/attempt/", {"answers": answers}, format="json")

    def test_questions_never_include_answers(self):
        res = self.client.get(f"/api/v1/learning/quizzes/{self.quiz_id}/")
        self.assertEqual(res.status_code, 200)
        for q in res.data["questions"]:
            self.assertNotIn("correct", q)
            self.assertNotIn("explanation", q)

    def test_grading_and_feedback(self):
        res = self.attempt([0, 1])
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual((res.data["score"], res.data["correct_count"], res.data["total"]), (50, 1, 2))
        self.assertTrue(res.data["passed"])  # pass mark is 50%
        first = res.data["results"][0]
        self.assertEqual((first["chosen"], first["correct"], first["is_correct"]), (0, 1, False))
        self.assertEqual(first["explanation"], "Two pairs make four.")

    def test_certificate_needs_lessons_and_a_passed_quiz(self):
        self.finish_lessons()
        self.assertFalse(Certificate.objects.exists())  # lessons alone aren't enough
        player = self.client.get(f"/api/v1/learning/courses/{self.course.slug}/").data
        self.assertEqual(player["progress"]["total_quizzes"], 1)
        self.assertLess(player["progress"]["percent"], 100)
        self.assertIsNotNone(player["modules"][0]["quiz"])
        enrollments = self.client.get("/api/v1/enrollments/").data["results"]
        self.assertEqual(enrollments[0]["progress"], 99)

        failed = self.attempt([0, 0])
        self.assertFalse(failed.data["passed"])
        self.assertIsNone(failed.data["certificate"])

        passed = self.attempt([1, 1])
        self.assertTrue(passed.data["course_completed"])
        code = passed.data["certificate"]
        self.assertTrue(code)

        self.client.force_authenticate(None)
        cert = self.client.get(f"/api/v1/certificates/verify/{code}/").data
        self.assertEqual(cert["skills"], ["Add numbers", "Write Python"])
        self.assertEqual(cert["assessment"], {"average": 100, "quizzes": 1})

    def test_outsiders_cannot_take_paid_quizzes(self):
        self.client.force_authenticate(make_user(email="outsider@example.com"))
        self.assertEqual(self.attempt([1, 1]).status_code, 403)


MIXED = {
    "title": "Chapter 1 test",
    "pass_percent": 60,
    "questions": [
        {"prompt": "2 + 2 = ?", "options": ["3", "4"], "correct": 1},
        {"kind": "WRITTEN", "prompt": "Explain what a loop does.",
         "model_answer": "It repeats a block of code.", "options": ["ignored"], "correct": 0},
    ],
}


class WrittenAnswerTests(APITestCase):
    """Written questions wait for the teacher, who marks them; then the score and certificate follow."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.teacher = make_teacher()
        self.course = make_course("mixed-course", price="500", teacher=self.teacher, lessons=1)
        module = CourseModule.objects.get(course=self.course)
        self.client.force_authenticate(self.teacher)
        res = self.client.put(f"/api/v1/teach/modules/{module.id}/quiz/", MIXED, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.quiz_id = res.data["id"]
        self.written = res.data["questions"][1]
        self.student = make_user()
        Enrollment.objects.create(student=self.student, course=self.course, status=Enrollment.Status.ACTIVE)
        self.client.force_authenticate(self.student)
        for lesson in lessons_of(self.course):
            self.client.post(f"/api/v1/learning/lessons/{lesson.id}/progress/", {"completed": True}, format="json")

    def attempt(self, answers):
        res = self.client.post(f"/api/v1/learning/quizzes/{self.quiz_id}/attempt/", {"answers": answers}, format="json")
        if res.status_code == 200:
            self.written_id = res.data["results"][1]["question"]
        return res

    def review(self, attempt_id, correct, user=None):
        self.client.force_authenticate(user or self.teacher)
        written_id = self.written_id
        return self.client.post(f"/api/v1/teach/reviews/{attempt_id}/", {
            "marks": [{"question": written_id, "correct": correct, "feedback": "Nice and clear."}],
            "feedback": "Good work overall.",
        }, format="json")

    def test_teacher_saves_written_question(self):
        self.assertEqual(self.written["kind"], "WRITTEN")
        self.assertEqual(self.written["options"], [])
        self.assertIsNone(self.written["correct"])
        self.assertEqual(self.written["model_answer"], "It repeats a block of code.")
        quiz = self.client.get(f"/api/v1/learning/quizzes/{self.quiz_id}/").data
        self.assertEqual([q["kind"] for q in quiz["questions"]], ["CHOICE", "WRITTEN"])
        self.assertNotIn("model_answer", quiz["questions"][1])

    def test_written_answers_wait_for_review_then_pass(self):
        res = self.attempt([1, "  It runs the same code again and again.  "])
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], "PENDING")
        self.assertIsNone(res.data["score"])
        self.assertFalse(res.data["passed"])
        self.assertEqual(res.data["results"][1]["text"], "It runs the same code again and again.")
        self.assertEqual(res.data["results"][1]["model_answer"], "")  # hidden until marked
        self.assertFalse(Certificate.objects.exists())

        # Can't send more answers while waiting; the player shows it as pending.
        self.assertEqual(self.attempt([1, "again"]).status_code, 400)
        player = self.client.get(f"/api/v1/learning/courses/{self.course.slug}/").data
        self.assertTrue(player["modules"][0]["quiz"]["pending"])
        self.assertEqual(self.client.get(f"/api/v1/learning/quizzes/{self.quiz_id}/").data["latest"]["status"], "PENDING")

        self.client.force_authenticate(self.teacher)
        self.assertEqual(self.client.get("/api/v1/teach/summary/").data["pending_reviews"], 1)
        listing = self.client.get("/api/v1/teach/reviews/").data
        self.assertEqual([a["id"] for a in listing["pending"]], [res.data["id"]])

        reviewed = self.review(res.data["id"], correct=True)
        self.assertEqual(reviewed.status_code, 200, reviewed.data)
        self.assertEqual((reviewed.data["score"], reviewed.data["passed"]), (100, True))
        self.assertTrue(reviewed.data["certificate"])
        self.assertEqual(self.review(res.data["id"], correct=True).status_code, 400)  # only once

        self.client.force_authenticate(self.student)
        latest = self.client.get(f"/api/v1/learning/quizzes/{self.quiz_id}/").data["latest"]
        self.assertEqual(latest["status"], "REVIEWED")
        self.assertEqual(latest["feedback"], "Good work overall.")
        self.assertEqual(latest["results"][1]["feedback"], "Nice and clear.")
        self.assertEqual(latest["results"][1]["model_answer"], "It repeats a block of code.")

    def test_marked_wrong_can_retry(self):
        res = self.attempt([1, "No idea"])
        reviewed = self.review(res.data["id"], correct=False)
        self.assertEqual((reviewed.data["score"], reviewed.data["passed"]), (50, False))
        self.client.force_authenticate(self.student)
        self.assertEqual(self.attempt([1, "It repeats code."]).status_code, 200)

    def test_only_the_course_teacher_reviews(self):
        res = self.attempt([1, "Answer"])
        other = make_teacher(email="other@example.com")
        self.assertEqual(self.review(res.data["id"], correct=True, user=other).status_code, 404)

    def test_review_must_mark_every_written_answer(self):
        res = self.attempt([1, "Answer"])
        self.client.force_authenticate(self.teacher)
        bad = self.client.post(f"/api/v1/teach/reviews/{res.data['id']}/", {"marks": []}, format="json")
        self.assertEqual(bad.status_code, 400)


class AdminQuizPagesTests(WrittenAnswerTests):
    """The Django admin shows chapter quizzes; students' answers stay between the student and their teacher."""

    def test_admin_pages_render(self):
        attempt_id = self.attempt([1, "It repeats code."]).data["id"]
        admin_user = make_user(email="root@example.com")
        admin_user.is_staff = admin_user.is_superuser = True
        admin_user.save()
        self.client.force_login(admin_user)
        for url in ["/admin/courses/quiz/", f"/admin/courses/quiz/{self.quiz_id}/change/",
                    "/admin/learning/lessoncomment/", "/admin/learning/lessonview/"]:
            res = self.client.get(url)
            self.assertEqual(res.status_code, 200, url)
        self.assertEqual(self.client.get(f"/admin/learning/quizattempt/{attempt_id}/change/").status_code, 404)

    def test_quiz_answers_are_not_in_the_admin_portal(self):
        self.client.force_authenticate(make_admin())
        self.assertEqual(self.client.get("/api/v1/manage/data/quiz-answers/").status_code, 404)
