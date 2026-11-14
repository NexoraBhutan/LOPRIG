from django.conf import settings
from django.contrib import admin, messages
from django.core.exceptions import PermissionDenied
from django.db.models import Count, Prefetch, Q
from django.shortcuts import get_object_or_404, redirect
from django.utils.html import format_html
from django.urls import path, reverse
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_POST
from unfold.admin import ModelAdmin, TabularInline
from unfold.decorators import action, display

from apps.users.models import User

from . import services
from .models import Category, Course, CourseModule, Lesson, LessonResource, Quiz, QuizQuestion
from .serializers import format_duration

STATUS_COLORS = {
    Course.Status.DRAFT.label: "info",
    Course.Status.PENDING_REVIEW.label: "warning",
    Course.Status.PUBLISHED.label: "success",
    Course.Status.REJECTED.label: "danger",
}


@admin.register(Category)
class CategoryAdmin(ModelAdmin):
    list_display = ["title", "slug", "icon", "order"]
    list_editable = ["order"]
    prepopulated_fields = {"slug": ["title"]}


class CourseModuleInline(TabularInline):
    model = CourseModule
    extra = 0
    show_change_link = True
    tab = True


@admin.register(Course)
class CourseAdmin(ModelAdmin):
    list_display = ["show_cover", "title", "show_teacher", "category", "show_status", "show_price", "students_count",
                    "published_at"]
    list_display_links = ["show_cover", "title"]
    list_filter = ["status", "category", "level"]
    list_filter_submit = True
    list_select_related = ["teacher", "category"]
    search_fields = ["title", "teacher__name", "teacher__email"]
    prepopulated_fields = {"slug": ["title"]}
    autocomplete_fields = ["teacher"]
    readonly_fields = ["status", "students_count", "published_at", "created_at", "updated_at", "cover_preview"]
    inlines = [CourseModuleInline]
    actions = ["approve_courses", "reject_courses"]
    actions_detail = ["approve_detail", "reject_detail"]
    fieldsets = (
        ("Course", {"fields": ("title", "slug", "teacher", "category", "level", "language", "description")}),
        ("Pricing (Nu.)", {"fields": ("price", "discount_price")}),
        ("Outcomes", {"fields": ("what_you_learn", "requirements")}),
        ("Appearance", {"fields": ("cover_image", "cover_preview", "thumbnail_url", "gradient_start", "gradient_end",
                                   "bestseller")}),
        ("Review", {"fields": ("status", "review_note", "published_at")}),
        ("Stats", {"fields": ("rating", "students_count", "created_at", "updated_at")}),
    )

    @display(description="Teacher", ordering="teacher__name")
    def show_teacher(self, obj):
        return obj.teacher.name

    @display(description="Cover")
    def show_cover(self, obj):
        url = obj.cover_image.url if obj.cover_image else obj.thumbnail_url
        if url:
            return format_html('<img src="{}" alt="" style="width:64px;height:40px;object-fit:cover;border-radius:6px">', url)
        return format_html('<span style="display:block;width:64px;height:40px;border-radius:6px;'
                           'background:linear-gradient(135deg,{},{})"></span>', obj.gradient_start, obj.gradient_end)

    @display(description="Cover preview")
    def cover_preview(self, obj):
        if not obj.cover_image:
            return "No uploaded cover. The card uses the image link or the colour gradient."
        return format_html('<img src="{}" alt="" style="max-width:360px;border-radius:10px">', obj.cover_image.url)

    @display(description="Status", label=STATUS_COLORS)
    def show_status(self, obj):
        return obj.get_status_display()

    @display(description="Price", ordering="price")
    def show_price(self, obj):
        return "Free" if obj.is_free else f"Nu. {obj.current_price:,.0f}"

    @admin.action(description="Approve and publish selected courses")
    def approve_courses(self, request, queryset):
        courses = list(queryset.exclude(status=Course.Status.PUBLISHED))
        for course in courses:
            services.approve(course)
        self.message_user(request, f"Published {len(courses)} course(s). Teachers were notified.", messages.SUCCESS)

    @admin.action(description="Reject selected courses (uses each course's review note)")
    def reject_courses(self, request, queryset):
        courses = list(queryset.exclude(status=Course.Status.REJECTED))
        for course in courses:
            services.reject(course)
        self.message_user(request, f"Rejected {len(courses)} course(s). Teachers were notified.", messages.WARNING)

    @action(description="Approve & publish", url_path="approve", icon="check_circle")
    def approve_detail(self, request, object_id):
        course = get_object_or_404(Course, pk=object_id)
        services.approve(course)
        self.message_user(request, f"“{course.title}” is published. The teacher was notified.", messages.SUCCESS)
        return redirect(reverse("admin:courses_course_change", args=[object_id]))

    @action(description="Reject", url_path="reject", icon="block")
    def reject_detail(self, request, object_id):
        course = get_object_or_404(Course, pk=object_id)
        if not course.review_note:
            self.message_user(
                request, "Write the reason in “Review note” and save first, so the teacher knows what to fix.",
                messages.ERROR,
            )
        else:
            services.reject(course)
            self.message_user(request, f"“{course.title}” was rejected. The teacher was notified.", messages.WARNING)
        return redirect(reverse("admin:courses_course_change", args=[object_id]))


class LessonInline(TabularInline):
    model = Lesson
    extra = 0
    fields = ["order", "title", "kind", "duration_seconds", "is_preview"]
    show_change_link = True


@admin.register(CourseModule)
class CourseModuleAdmin(ModelAdmin):
    list_display = ["title", "course", "order"]
    list_filter = ["course"]
    search_fields = ["title", "course__title"]
    inlines = [LessonInline]


class LessonResourceInline(TabularInline):
    model = LessonResource
    extra = 0


TEACHER_PARAM = "module__course__teacher__id__exact"
MIN_REJECT_NOTE = 10  # same rule as the admin portal's reject form

# Course cards on the Lessons page: waiting-for-review first.
COURSE_CARD_ORDER = {
    Course.Status.PENDING_REVIEW: 0, Course.Status.REJECTED: 1, Course.Status.DRAFT: 2, Course.Status.PUBLISHED: 3,
}
COURSE_CARD_STATUS = {
    Course.Status.PENDING_REVIEW: ("Awaiting review", "pending"),
    Course.Status.PUBLISHED: ("Live", "live"),
    Course.Status.REJECTED: ("Changes requested", "rejected"),
    Course.Status.DRAFT: ("Draft", "draft"),
}


def course_cards(courses):
    """Everything a review card needs: status, lessons grouped by module, and what's still missing."""
    lessons = Prefetch("lessons", queryset=Lesson.objects.order_by("order", "id"))
    modules = Prefetch("modules", queryset=CourseModule.objects.order_by("order", "id").prefetch_related(lessons))
    cards = []
    for course in courses.select_related("teacher", "category").prefetch_related(modules):
        mods = list(course.modules.all())
        lesson_list = [lesson for m in mods for lesson in m.lessons.all()]
        label, tone = COURSE_CARD_STATUS[course.status]
        cards.append({
            "course": course,
            "status_label": label,
            "tone": tone,
            "modules": mods,
            "lesson_count": len(lesson_list),
            "duration": format_duration(sum(lesson.duration_seconds for lesson in lesson_list)),
            "problems": services.review_problems(course) if course.status == Course.Status.PENDING_REVIEW else [],
            "admin_url": reverse("admin:courses_course_change", args=[course.pk]),
            "site_url": f"{settings.FRONTEND_URL.rstrip('/')}/courses/{course.slug}",
        })
    return sorted(cards, key=lambda c: (COURSE_CARD_ORDER[c["course"].status], -c["course"].updated_at.timestamp()))


@admin.register(Lesson)
class LessonAdmin(ModelAdmin):
    list_display = ["title", "show_teacher", "module", "kind", "duration_seconds", "is_preview"]
    list_filter = [("module__course__teacher", admin.RelatedOnlyFieldListFilter), "kind", "is_preview", "module__course"]
    list_select_related = ["module__course__teacher"]
    search_fields = ["title", "module__course__title", "module__course__teacher__name"]
    inlines = [LessonResourceInline]
    # Teacher profile cards above the list; clicking one shows only that teacher's lessons.
    list_before_template = "admin/courses/lesson/teacher_cards.html"

    @display(description="Teacher")
    def show_teacher(self, obj):
        return obj.module.course.teacher.name

    def changelist_view(self, request, extra_context=None):
        selected = request.GET.get(TEACHER_PARAM, "")

        def url_for(teacher_id):
            params = request.GET.copy()
            params.pop("p", None)  # back to page 1
            params.pop(TEACHER_PARAM, None)
            if teacher_id:
                params[TEACHER_PARAM] = teacher_id
            return f"?{params.urlencode()}" if params else "?"

        teachers = (
            User.objects.filter(courses_taught__isnull=False)
            .annotate(
                course_count=Count("courses_taught", distinct=True),
                published_count=Count("courses_taught", distinct=True,
                                      filter=Q(courses_taught__status=Course.Status.PUBLISHED)),
                lesson_count=Count("courses_taught__modules__lessons", distinct=True),
            )
            .order_by("name")
        )
        cards = [{
            "teacher": t,
            "initial": (t.name or t.email)[:1].upper(),
            "active": selected == str(t.pk),
            # Clicking the selected card again clears the filter.
            "url": url_for("" if selected == str(t.pk) else str(t.pk)),
        } for t in teachers]
        teacher_selected = next((c["teacher"] for c in cards if c["active"]), None)
        # Below the teacher cards: that teacher's courses, or (no teacher picked) every course awaiting review.
        courses = (Course.objects.filter(teacher=teacher_selected) if teacher_selected
                   else Course.objects.filter(status=Course.Status.PENDING_REVIEW))
        extra_context = {
            **(extra_context or {}),
            "teacher_cards": cards,
            "teacher_selected": teacher_selected,
            "all_teachers_url": url_for(""),
            "all_lessons_count": Lesson.objects.count(),
            "course_cards": course_cards(courses),
            "pending_total": Course.objects.filter(status=Course.Status.PENDING_REVIEW).count(),
            "min_reject_note": MIN_REJECT_NOTE,
            # A lesson search means they want the table, so show it straight away.
            "show_table": bool(request.GET.get("q")),
        }
        return super().changelist_view(request, extra_context)

    def get_urls(self):
        review = path("review/<int:course_id>/<str:decision>/", self.admin_site.admin_view(self.review_course),
                      name="courses_lesson_review")
        return [review, *super().get_urls()]

    @staticmethod
    @require_POST
    def review_course(request, course_id, decision):
        """Approve / reject buttons on the Lessons page's course cards."""
        if not (request.user.is_superuser or request.user.role == User.Role.ADMIN):
            raise PermissionDenied
        course = get_object_or_404(Course, pk=course_id)
        back = request.POST.get("next", "")
        if not url_has_allowed_host_and_scheme(back, allowed_hosts={request.get_host()}):
            back = reverse("admin:courses_lesson_changelist")

        if decision == "approve":
            if course.status == Course.Status.PUBLISHED:
                messages.info(request, f"“{course.title}” is already live.")
            else:
                services.approve(course)
                messages.success(request, f"Approved: “{course.title}” is now live. {course.teacher.name} was notified.")
        elif decision == "reject":
            note = request.POST.get("note", "").strip()
            if len(note) < MIN_REJECT_NOTE:
                messages.error(request, f"Not rejected: tell {course.teacher.name} what to fix "
                                        f"({MIN_REJECT_NOTE}+ characters).")
            else:
                services.reject(course, note)
                messages.warning(request, f"Rejected: “{course.title}” was sent back to {course.teacher.name} "
                                          "with your note.")
        else:
            raise PermissionDenied
        return redirect(back)


class QuizQuestionInline(TabularInline):
    model = QuizQuestion
    extra = 0
    fields = ["order", "kind", "prompt", "options", "correct", "model_answer"]
    ordering = ["order", "id"]

    def has_add_permission(self, request, obj=None):
        return request.user.is_superuser  # teachers write questions; website admins only check and fix


@admin.register(Quiz)
class QuizAdmin(ModelAdmin):
    """Chapter quizzes. Teachers build them in the teacher portal; this is for checking and fixing."""

    list_display = ["title", "module", "show_course", "pass_percent", "show_questions", "show_written", "updated_at"]
    list_filter = [("module__course", admin.RelatedOnlyFieldListFilter)]
    list_select_related = ["module__course"]
    search_fields = ["title", "module__title", "module__course__title"]
    raw_id_fields = ["module"]

    def has_add_permission(self, request):
        # Teachers create quizzes in their course editor. Website admins can check, fix or delete them,
        # but not add new ones; only the site administrator can.
        return request.user.is_superuser
    inlines = [QuizQuestionInline]

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            n_questions=Count("questions", distinct=True),
            n_written=Count("questions", distinct=True, filter=Q(questions__kind=QuizQuestion.Kind.WRITTEN)),
        )

    @display(description="Course", ordering="module__course__title")
    def show_course(self, obj):
        return obj.module.course.title

    @display(description="Questions", ordering="n_questions")
    def show_questions(self, obj):
        return obj.n_questions

    @display(description="Written", ordering="n_written")
    def show_written(self, obj):
        return obj.n_written
