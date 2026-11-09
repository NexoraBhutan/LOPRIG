from django.conf import settings
from django.contrib import admin
from django.utils.html import format_html, format_html_join
from unfold.admin import ModelAdmin
from unfold.decorators import display

from .models import ActivityDay, LessonComment, LessonProgress, LessonView, QuizAttempt

ATTEMPT_COLORS = {
    QuizAttempt.Status.PENDING.label: "warning",
    QuizAttempt.Status.REVIEWED.label: "success",
    QuizAttempt.Status.GRADED.label: "info",
}


@admin.register(LessonProgress)
class LessonProgressAdmin(ModelAdmin):
    list_display = ["enrollment", "lesson", "completed", "position_seconds", "updated_at"]
    list_filter = ["completed"]
    raw_id_fields = ["enrollment", "lesson"]


@admin.register(ActivityDay)
class ActivityDayAdmin(ModelAdmin):
    list_display = ["student", "day"]
    raw_id_fields = ["student"]


@admin.register(QuizAttempt)
class QuizAttemptAdmin(ModelAdmin):
    """Students' chapter quiz answers. Teachers mark written answers in the teacher portal;
    here admins can follow up on ones waiting too long and read what was answered."""

    list_display = ["show_student", "quiz", "show_course", "show_status", "show_score", "passed", "created_at",
                    "reviewed_at"]
    list_filter = ["status", "passed", ("quiz__module__course", admin.RelatedOnlyFieldListFilter)]
    list_filter_submit = True
    list_select_related = ["enrollment__student", "quiz__module__course"]
    search_fields = ["enrollment__student__name", "enrollment__student__email", "quiz__title",
                     "quiz__module__course__title"]
    date_hierarchy = "created_at"
    fields = ["show_student", "quiz", "show_status", "show_score", "passed", "show_answers", "feedback",
              "reviewed_by", "reviewed_at", "created_at", "teacher_link"]
    readonly_fields = fields

    def has_add_permission(self, request):
        return False  # attempts come from students taking quizzes

    def has_change_permission(self, request, obj=None):
        return False  # marks come from the course's teacher

    @display(description="Student", ordering="enrollment__student__name")
    def show_student(self, obj):
        return obj.enrollment.student.name

    @display(description="Course", ordering="quiz__module__course__title")
    def show_course(self, obj):
        return obj.quiz.module.course.title

    @display(description="Status", label=ATTEMPT_COLORS)
    def show_status(self, obj):
        return obj.get_status_display()

    @display(description="Score", ordering="score")
    def show_score(self, obj):
        return "Not marked yet" if obj.score is None else f"{obj.score}%"

    @display(description="Answers")
    def show_answers(self, obj):
        if not obj.questions:
            return "-"

        def answer(q, a):
            if q["kind"] == "WRITTEN":
                mark = obj.marks.get(str(q["id"]))
                verdict = "waiting for the teacher" if mark is None else ("correct" if mark["correct"] else "not correct")
                return a or "(no answer)", verdict
            chosen = q["options"][a] if isinstance(a, int) and a < len(q["options"]) else "(no answer)"
            return chosen, "correct" if a == q["correct"] else "not correct"

        rows = ((i + 1, q["prompt"], *answer(q, a)) for i, (q, a) in enumerate(zip(obj.questions, obj.answers)))
        return format_html(
            '<ol style="margin:0;padding-left:1.2em">{}</ol>',
            format_html_join("", '<li style="margin-bottom:.6em"><strong>{}. {}</strong><br>{} <em>({})</em></li>',
                             rows),
        )

    @display(description="Teacher portal")
    def teacher_link(self, obj):
        if obj.status == QuizAttempt.Status.GRADED:
            return "-"
        url = f"{settings.FRONTEND_URL.rstrip('/')}/teach/reviews/{obj.pk}"
        return format_html('<a href="{}" target="_blank" rel="noopener">Open in the teacher portal</a>', url)


@admin.register(LessonComment)
class LessonCommentAdmin(ModelAdmin):
    """Comments under lessons. Delete anything abusive; replies go with the comment they answer."""

    list_display = ["show_body", "author", "lesson", "show_course", "show_reply", "created_at"]
    list_filter = [("lesson__module__course", admin.RelatedOnlyFieldListFilter)]
    list_select_related = ["author", "lesson__module__course"]
    search_fields = ["body", "author__name", "author__email", "lesson__title"]
    date_hierarchy = "created_at"
    raw_id_fields = ["lesson", "author", "parent"]

    def has_add_permission(self, request):
        return False

    @display(description="Comment")
    def show_body(self, obj):
        return obj.body if len(obj.body) <= 80 else f"{obj.body[:80]}…"

    @display(description="Course", ordering="lesson__module__course__title")
    def show_course(self, obj):
        return obj.lesson.module.course.title

    @display(description="Reply", boolean=True)
    def show_reply(self, obj):
        return obj.parent_id is not None


@admin.register(LessonView)
class LessonViewAdmin(ModelAdmin):
    """Who opened which lesson (one row per student per lesson). Read only."""

    list_display = ["student", "lesson", "show_course", "created_at"]
    list_filter = [("lesson__module__course", admin.RelatedOnlyFieldListFilter)]
    list_select_related = ["student", "lesson__module__course"]
    search_fields = ["student__name", "student__email", "lesson__title"]
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    @display(description="Course", ordering="lesson__module__course__title")
    def show_course(self, obj):
        return obj.lesson.module.course.title
