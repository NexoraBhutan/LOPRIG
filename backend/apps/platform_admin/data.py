"""The admin portal's data manager: every table Django Admin has, in the website's admin portal.

One registry (TABLES) describes each table: which columns to list, what to search and filter
by, which fields can be edited, and whether rows can be added or deleted. Generic endpoints
then list, show, add, edit and delete rows for any registered table, so a new table needs only
an entry here and nothing in the frontend.

Some changes have side effects that the dedicated portal pages handle (approving a course emails
the teacher; verifying a payment unlocks the course; creating a teacher emails their login).
Those fields are read-only here and the table's `note` points to the right page.
"""
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.db.models import ProtectedError, Q, RestrictedError
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.certificates.models import Certificate
from apps.courses.models import Category, Course, CourseModule, Lesson, LessonResource, Quiz, QuizQuestion
from apps.enrollments.models import Enrollment, SavedCourse
from apps.learning.models import ActivityDay, LessonComment, LessonProgress, LessonView
from apps.notifications.models import Notification
from apps.payments.models import Payment, PaymentSettings
from apps.users.models import User
from apps.users.permissions import IsPlatformAdmin

PAGE_SIZE = 25
OPTIONS_LIMIT = 20
RELATION_FILTER_LIMIT = 100


@dataclass(frozen=True)
class Table:
    model: type[models.Model]
    label: str
    singular: str
    group: str
    icon: str
    columns: tuple[str, ...]
    search: tuple[str, ...] = ()
    filters: tuple[str, ...] = ()
    readonly: tuple[str, ...] = ()
    hidden: tuple[str, ...] = ()
    can_add: bool = True
    can_edit: bool = True
    can_delete: bool = True
    ordering: str = "-id"
    related: tuple[str, ...] = ()  # select_related for listing
    note: str = ""


GROUPS = ("Catalogue", "People", "Learning", "Money & messages")

TABLES: dict[str, Table] = {
    # Catalogue
    "courses": Table(
        Course, "Courses", "course", "Catalogue", "BookOpen",
        columns=("title", "teacher", "category", "status", "price", "students_count", "published_at"),
        search=("title", "slug", "teacher__name", "teacher__email"),
        filters=("status", "category", "level", "bestseller"),
        readonly=("status", "students_count", "published_at", "created_at", "updated_at", "cover_image"),
        related=("teacher", "category"), ordering="-updated_at",
        note="To approve or reject a course, use Course review: the teacher is notified from there.",
    ),
    "categories": Table(
        Category, "Categories", "category", "Catalogue", "SquaresFour",
        columns=("title", "slug", "icon", "order"), search=("title", "slug"), ordering="order",
    ),
    "chapters": Table(
        CourseModule, "Chapters", "chapter", "Catalogue", "ListBullets",
        columns=("title", "course", "order"), search=("title", "course__title"), filters=("course",),
        related=("course",), ordering="course_id",
    ),
    "lessons": Table(
        Lesson, "Lessons", "lesson", "Catalogue", "PlayCircle",
        columns=("title", "module", "kind", "duration_seconds", "is_preview", "video_status"),
        search=("title", "module__title", "module__course__title"),
        filters=("module__course__teacher", "kind", "is_preview", "video_status", "module__course"),
        readonly=("video_id", "video_status"), related=("module__course",), ordering="module_id",
        note="Teachers upload lesson videos from their course editor.",
    ),
    "resources": Table(
        LessonResource, "Lesson resources", "resource", "Catalogue", "LinkSimple",
        columns=("title", "lesson", "url"), search=("title", "lesson__title"), readonly=("file",),
        related=("lesson",),
    ),
    "quizzes": Table(
        Quiz, "Chapter quizzes", "quiz", "Catalogue", "Exam",
        columns=("title", "module", "pass_percent", "updated_at"), search=("title", "module__title"),
        readonly=("updated_at",), related=("module__course",), can_add=False,
        note="Teachers create chapter quizzes in their course editor. Here you can check, correct or delete them.",
    ),
    "questions": Table(
        QuizQuestion, "Quiz questions", "question", "Catalogue", "Question",
        columns=("prompt", "quiz", "kind", "order"), search=("prompt", "quiz__title"), filters=("kind", "quiz"),
        related=("quiz",), ordering="quiz_id", can_add=False,
        note="Teachers write quiz questions in their course editor. To fix one here: Options is a list like "
             "[\"Yes\", \"No\"] and Correct is the number of the right option, counting from 0.",
    ),
    # People
    "users": Table(
        User, "Users", "user", "People", "Users",
        columns=("name", "email", "role", "is_active", "must_change_password", "date_joined"),
        search=("name", "email"), filters=("role", "is_active", "must_change_password"),
        readonly=("last_login", "date_joined", "password_changed_at", "google_picture", "avatar",
                  "must_change_password", "is_staff", "is_superuser"),
        hidden=("password",), can_add=False, ordering="-date_joined",
        note="Add teachers and admins from Users & teachers, which emails them their login.",
    ),
    # Learning
    "enrollments": Table(
        Enrollment, "Enrollments", "enrollment", "Learning", "GraduationCap",
        columns=("student", "course", "status", "activated_at", "completed_at"),
        search=("student__name", "student__email", "course__title"), filters=("status", "course"),
        readonly=("created_at", "updated_at"), related=("student", "course"),
    ),
    "saved-courses": Table(
        SavedCourse, "Saved courses", "saved course", "Learning", "BookmarkSimple",
        columns=("student", "course", "created_at"), search=("student__email", "course__title"),
        readonly=("created_at",), related=("student", "course"),
    ),
    "lesson-progress": Table(
        LessonProgress, "Lesson progress", "progress record", "Learning", "TrendUp",
        columns=("enrollment", "lesson", "completed", "position_seconds", "updated_at"),
        search=("enrollment__student__email", "lesson__title"), filters=("completed",),
        readonly=("updated_at",), can_add=False, related=("enrollment__student", "enrollment__course", "lesson"),
    ),
    "comments": Table(
        LessonComment, "Lesson comments", "comment", "Learning", "ChatCircleText",
        columns=("body", "author", "lesson", "parent", "created_at"),
        search=("body", "author__name", "author__email", "lesson__title"),
        readonly=("lesson", "author", "parent", "created_at"), can_add=False, related=("author", "lesson"),
        note="Deleting a comment also deletes its replies.",
    ),
    "lesson-views": Table(
        LessonView, "Lesson views", "view", "Learning", "Eye",
        columns=("student", "lesson", "created_at"), search=("student__email", "lesson__title"),
        can_add=False, can_edit=False, related=("student", "lesson"),
    ),
    "activity": Table(
        ActivityDay, "Learning days", "learning day", "Learning", "CalendarCheck",
        columns=("student", "day"), search=("student__email",), can_add=False, related=("student",),
        ordering="-day",
    ),
    "certificates": Table(
        Certificate, "Certificates", "certificate", "Learning", "Certificate",
        columns=("code", "student", "course", "issued_at"),
        search=("code", "student__name", "student__email", "course__title"), filters=("course",),
        readonly=("enrollment", "student", "course", "code", "pdf", "issued_at"), can_add=False,
        related=("student", "course"), ordering="-issued_at",
    ),
    # Money & messages
    "payments": Table(
        Payment, "Payments", "payment", "Money & messages", "Receipt",
        columns=("reference", "student", "course", "amount", "status", "provider", "created_at"),
        search=("reference", "journal_number", "student__name", "student__email", "course__title"),
        filters=("status", "provider"), hidden=("raw_event",), can_add=False, can_edit=False, can_delete=False,
        related=("student", "course"), ordering="-created_at",
        note="To verify or reject a payment, use Payments: that's what unlocks the course for the student.",
    ),
    "payment-settings": Table(
        PaymentSettings, "Payment settings", "payment setting", "Money & messages", "QrCode",
        columns=("account_name", "bank_name", "account_number", "alert_email", "updated_at"),
        readonly=("qr_image", "updated_at"), can_add=False, can_delete=False,
        note="Upload the QR code image from Payments → QR settings.",
    ),
    "notifications": Table(
        Notification, "Notifications", "notification", "Money & messages", "Bell",
        columns=("title", "user", "kind", "read_at", "created_at"),
        search=("title", "message", "user__name", "user__email"), filters=("kind",),
        readonly=("created_at",), related=("user",), ordering="-created_at",
    ),
}


# --- Labels: how a row appears in lists and pickers -------------------------------------------

def label(obj) -> str:
    match obj:
        case User():
            return f"{obj.name} ({obj.email})"
        case Enrollment():
            return f"{obj.student.name} · {obj.course.title}"
        case LessonProgress():
            return f"{obj.enrollment.student.name} · {obj.lesson.title}"
        case LessonComment():
            return obj.body[:60]
        case Certificate():
            return obj.code
        case Payment():
            return obj.reference
        case Notification():
            return obj.title
        case CourseModule():
            return f"{obj.course.title} › {obj.title}"
        case Quiz():
            return obj.title
        case _:
            return str(obj)


# --- Field description and value conversion -----------------------------------------------------

def _fields(table: Table) -> list[models.Field]:
    return [f for f in table.model._meta.concrete_fields if f.name not in table.hidden]


def _table_slug_for(model) -> str | None:
    return next((slug for slug, t in TABLES.items() if t.model is model), None)


def _kind(f: models.Field) -> str:
    if f.is_relation:
        return "relation"
    if f.choices:
        return "choice"
    return {
        "BooleanField": "boolean", "DateField": "date", "DateTimeField": "datetime",
        "DecimalField": "decimal", "JSONField": "json", "FileField": "file", "ImageField": "file",
        "TextField": "textarea", "EmailField": "email", "URLField": "url",
    }.get(f.get_internal_type(), "integer" if isinstance(f, (models.IntegerField, models.AutoField)) else "text")


def _editable(table: Table, f: models.Field) -> bool:
    return (table.can_edit and f.editable and not f.primary_key and f.name not in table.readonly
            and _kind(f) != "file" and not getattr(f, "auto_now", False) and not getattr(f, "auto_now_add", False))


def field_meta(table: Table, f: models.Field) -> dict:
    meta = {
        "name": f.name,
        "label": str(f.verbose_name).capitalize(),
        "kind": _kind(f),
        "editable": _editable(table, f),
        "required": not (f.blank or f.null or f.has_default()),
        "help": str(f.help_text or ""),
    }
    if f.choices:
        meta["options"] = [{"value": v, "label": str(lbl)} for v, lbl in f.flatchoices]
    if f.is_relation:
        meta["table"] = _table_slug_for(f.related_model)
    return meta


def _value(obj, f: models.Field):
    if f.is_relation:
        related = getattr(obj, f.name)
        return {"id": related.pk, "label": label(related)} if related else None
    value = getattr(obj, f.attname)
    if _kind(f) == "file":
        return value.url if value else ""
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _row(table: Table, obj, names) -> dict:
    by_name = {f.name: f for f in _fields(table)}
    return {"id": obj.pk, "label": label(obj), "values": {n: _value(obj, by_name[n]) for n in names}}


def _parse(f: models.Field, raw):
    """Turn a submitted value into what the model field expects. Raises ValidationError."""
    kind = _kind(f)
    if raw in ("", None):
        if kind == "boolean":
            return False
        if kind in ("text", "textarea", "email", "url", "choice") and not f.null:
            return ""
        return None
    if kind == "relation":
        try:
            return f.related_model.objects.get(pk=raw)
        except (f.related_model.DoesNotExist, ValueError, TypeError):
            raise ValidationError(f"No {f.verbose_name} with id {raw}.")
    if kind == "boolean":
        return raw in (True, "true", "True", "1", 1)
    if kind == "integer":
        try:
            return int(raw)
        except (TypeError, ValueError):
            raise ValidationError("Enter a whole number.")
    if kind == "decimal":
        try:
            return Decimal(str(raw))
        except InvalidOperation:
            raise ValidationError("Enter a number.")
    if kind == "datetime":
        parsed = parse_datetime(raw) if isinstance(raw, str) else None
        if parsed is None:
            raise ValidationError("Enter a date and time.")
        return parsed
    if kind == "date":
        parsed = parse_date(raw) if isinstance(raw, str) else None
        if parsed is None:
            raise ValidationError("Enter a date.")
        return parsed
    return raw


def _table(slug: str) -> Table:
    if slug not in TABLES:
        raise NotFound("No such table.")
    return TABLES[slug]


def _save(table: Table, obj, data: dict) -> Response | None:
    """Apply submitted values, validate, save. Returns an error response, or None on success."""
    errors = {}
    for f in _fields(table):
        if f.name not in data or not _editable(table, f):
            continue
        try:
            setattr(obj, f.name, _parse(f, data[f.name]))
        except ValidationError as e:
            errors[f.name] = e.messages[0]
    if not errors:
        try:
            obj.full_clean()
        except ValidationError as e:
            errors = {k: v[0] for k, v in e.message_dict.items()}
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)
    obj.save()
    return None


def _delete(obj) -> str | None:
    """Delete a row; returns why not if other records still need it."""
    try:
        with transaction.atomic():
            obj.delete()
    except (ProtectedError, RestrictedError) as e:
        blocking = getattr(e, "protected_objects", None) or getattr(e, "restricted_objects", None) or []
        kinds = sorted({str(type(o)._meta.verbose_name_plural) for o in blocking})
        return f"Can't delete this: other records still use it ({', '.join(kinds) or 'linked data'})."
    return None


# --- Views ---------------------------------------------------------------------------------------

def describe(t: Table, slug: str) -> dict:
    """Everything the frontend needs to draw a table's list and form."""
    fields = {f.name: f for f in _fields(t)}
    filters = []
    for name in t.filters:
        if "__" in name:  # e.g. module__course: filter by a related table further away
            model = t.model
            for part in name.split("__"):
                model = model._meta.get_field(part).related_model
            title = str(model._meta.verbose_name).capitalize()
            options = None
        else:
            f = fields[name]
            title = str(f.verbose_name).capitalize()
            model = f.related_model if f.is_relation else None
            if f.choices:
                options = [{"value": str(v), "label": str(lbl)} for v, lbl in f.flatchoices]
            elif _kind(f) == "boolean":
                options = [{"value": "true", "label": "Yes"}, {"value": "false", "label": "No"}]
            elif not f.is_relation:  # plain text: the values in use
                values = t.model.objects.exclude(**{name: ""}).values_list(name, flat=True).distinct()
                options = [{"value": v, "label": v} for v in sorted(values[:RELATION_FILTER_LIMIT])]
            else:
                options = None
        if options is None:  # a related table: offer the ones actually used
            ids = [i for i in t.model.objects.values_list(name, flat=True).distinct()[:RELATION_FILTER_LIMIT] if i]
            options = sorted(({"value": str(o.pk), "label": label(o)} for o in model.objects.filter(pk__in=ids)),
                             key=lambda o: o["label"].lower())
        filters.append({"name": name, "label": title, "options": options})
    return {
        "slug": slug, "label": t.label, "singular": t.singular, "group": t.group, "icon": t.icon,
        "columns": [field_meta(t, fields[c]) for c in t.columns],
        "fields": [field_meta(t, f) for f in fields.values()],
        "filters": filters, "searchable": bool(t.search), "note": t.note,
        "can_add": t.can_add, "can_edit": t.can_edit, "can_delete": t.can_delete,
    }


class DataTablesView(APIView):
    """GET: every table, grouped like Django Admin's sidebar, with row counts."""

    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        return Response({
            "groups": [
                {"name": group, "tables": [
                    {"slug": slug, "label": t.label, "icon": t.icon, "count": t.model.objects.count()}
                    for slug, t in TABLES.items() if t.group == group
                ]}
                for group in GROUPS
            ],
        })


class DataListView(APIView):
    """GET: rows with search (?q=), filters (?f_<field>=value), sorting (?ordering=) and pages.
    POST: add a row."""

    permission_classes = [IsPlatformAdmin]

    def get(self, request, table):
        t = _table(table)
        qs = t.model.objects.all()
        if t.related:
            qs = qs.select_related(*t.related)
        if (q := request.query_params.get("q", "").strip()) and t.search:
            cond = Q()
            for name in t.search:
                cond |= Q(**{f"{name}__icontains": q})
            qs = qs.filter(cond)
        for name in t.filters:
            raw = request.query_params.get(f"f_{name}")
            if raw in (None, ""):
                continue
            if raw in ("true", "false"):
                qs = qs.filter(**{name: raw == "true"})
            else:
                qs = qs.filter(**{name: raw})
        ordering = request.query_params.get("ordering", "")
        qs = qs.order_by(ordering if ordering.lstrip("-") in t.columns else t.ordering, "-pk")

        total = qs.count()
        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except ValueError:
            page = 1
        rows = qs[(page - 1) * PAGE_SIZE: page * PAGE_SIZE]
        return Response({
            "table": describe(t, table),
            "count": total,
            "page": page,
            "pages": max(1, -(-total // PAGE_SIZE)),
            "results": [_row(t, obj, t.columns) for obj in rows],
        })

    def post(self, request, table):
        t = _table(table)
        if not t.can_add:
            return Response({"detail": t.note or f"{t.label} can't be added here."}, status=status.HTTP_403_FORBIDDEN)
        obj = t.model()
        if error := _save(t, obj, request.data):
            return error
        return Response(_row(t, obj, [f.name for f in _fields(t)]), status=status.HTTP_201_CREATED)


class DataDetailView(APIView):
    """GET: one row with every field. PATCH: edit it. DELETE: delete it."""

    permission_classes = [IsPlatformAdmin]

    def get(self, request, table, pk):
        t = _table(table)
        obj = get_object_or_404(t.model, pk=pk)
        return Response({"table": describe(t, table), "row": _row(t, obj, [f.name for f in _fields(t)])})

    def patch(self, request, table, pk):
        t = _table(table)
        if not t.can_edit:
            return Response({"detail": t.note or f"{t.label} can't be edited here."}, status=status.HTTP_403_FORBIDDEN)
        obj = get_object_or_404(t.model, pk=pk)
        if t.model is User and obj.pk == request.user.pk and (
                str(request.data.get("is_active", True)).lower() == "false"
                or request.data.get("role", obj.role) != obj.role):
            return Response({"detail": "You can't deactivate yourself or change your own role."},
                            status=status.HTTP_400_BAD_REQUEST)
        if error := _save(t, obj, request.data):
            return error
        return Response(_row(t, obj, [f.name for f in _fields(t)]))

    def delete(self, request, table, pk):
        t = _table(table)
        if not t.can_delete:
            return Response({"detail": t.note or f"{t.label} can't be deleted."}, status=status.HTTP_403_FORBIDDEN)
        obj = get_object_or_404(t.model, pk=pk)
        if t.model is User and obj.pk == request.user.pk:
            return Response({"detail": "You can't delete your own account."}, status=status.HTTP_400_BAD_REQUEST)
        if message := _delete(obj):
            return Response({"detail": message}, status=status.HTTP_409_CONFLICT)
        return Response(status=status.HTTP_204_NO_CONTENT)


class DataBulkDeleteView(APIView):
    """POST {"ids": [...]}: delete several rows; reports any that couldn't be deleted."""

    permission_classes = [IsPlatformAdmin]

    def post(self, request, table):
        t = _table(table)
        if not t.can_delete:
            return Response({"detail": t.note or f"{t.label} can't be deleted."}, status=status.HTTP_403_FORBIDDEN)
        ids = [int(i) for i in request.data.get("ids", []) if str(i).isdigit()][:PAGE_SIZE * 4]
        deleted, failed = 0, []
        for obj in t.model.objects.filter(pk__in=ids):
            if t.model is User and obj.pk == request.user.pk:
                failed.append({"id": obj.pk, "label": label(obj), "reason": "That's your own account."})
            elif message := _delete(obj):
                failed.append({"id": obj.pk, "label": label(obj), "reason": message})
            else:
                deleted += 1
        return Response({"deleted": deleted, "failed": failed})


class DataOptionsView(APIView):
    """GET ?q=: up to 20 rows of a table as {id, label}, for choosing a related record."""

    permission_classes = [IsPlatformAdmin]

    def get(self, request, table):
        t = _table(table)
        qs = t.model.objects.all()
        if t.related:
            qs = qs.select_related(*t.related)
        q = request.query_params.get("q", "").strip()
        if q:
            cond = Q(pk=q) if q.isdigit() else Q()
            for name in t.search:
                cond |= Q(**{f"{name}__icontains": q})
            qs = qs.filter(cond)
        return Response([{"id": o.pk, "label": label(o)} for o in qs.order_by(t.ordering, "-pk")[:OPTIONS_LIMIT]])
