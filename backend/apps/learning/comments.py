"""Lesson discussion and view counts.

Who can do what:
- read comments: anyone who can watch the lesson, plus the course's teacher and admins;
- post: enrolled students (or students on a free course), the course's teacher, admins;
- delete: the author, the course's teacher, admins (deleting a comment removes its replies).
Views are unique students: one LessonView row per student per lesson.
"""
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.exceptions import NotAuthenticated, PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.courses.models import Lesson

from . import services
from .models import LessonComment, LessonView

MAX_THREADS = 100  # newest top-level comments returned per lesson


def _lesson(pk) -> Lesson:
    return get_object_or_404(Lesson.objects.select_related("module__course"), pk=pk)


def can_moderate(user, lesson: Lesson) -> bool:
    return user.is_authenticated and (user.is_platform_admin or lesson.module.course.teacher_id == user.pk)


def check_read_access(user, lesson: Lesson) -> None:
    if not can_moderate(user, lesson):
        services.check_lesson_access(user, lesson)  # raises when they can't watch it


def check_post_access(user, lesson: Lesson) -> None:
    if not user.is_authenticated:
        raise NotAuthenticated("Log in to join the discussion.")
    if can_moderate(user, lesson):
        return
    # A preview lesson is watchable without enrolling, but only students in the course can comment.
    if services.check_lesson_access(user, lesson) is None:
        raise PermissionDenied("Enroll in this course to join the discussion.")


class CommentAuthorSerializer(serializers.Serializer):
    name = serializers.CharField()
    avatar = serializers.CharField(source="avatar_url")
    avatar_color = serializers.CharField()
    role = serializers.CharField()


class LessonCommentSerializer(serializers.ModelSerializer):
    author = CommentAuthorSerializer(read_only=True)
    is_instructor = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()

    class Meta:
        model = LessonComment
        fields = ["id", "body", "created_at", "parent", "author", "is_instructor", "can_delete", "replies"]

    def get_is_instructor(self, obj) -> bool:
        return obj.author_id == self.context["teacher_id"]

    def get_can_delete(self, obj) -> bool:
        user = self.context["request"].user
        return self.context["moderator"] or (user.is_authenticated and obj.author_id == user.pk)

    def get_replies(self, obj) -> list:
        if obj.parent_id:
            return []
        replies = sorted(obj.replies.all(), key=lambda r: r.created_at)  # prefetched; oldest first
        return LessonCommentSerializer(replies, many=True, context=self.context).data


class CommentInputSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=LessonComment.BODY_MAX, trim_whitespace=True, error_messages={
        "blank": "Write something before posting.",
        "max_length": f"Comments can be up to {LessonComment.BODY_MAX} characters.",
    })
    parent = serializers.IntegerField(required=False, allow_null=True)


def _context(request, lesson):
    return {"request": request, "teacher_id": lesson.module.course.teacher_id,
            "moderator": can_moderate(request.user, lesson)}


class LessonCommentsView(APIView):
    """GET: the lesson's discussion, newest first, with replies. POST: add a comment or a reply."""

    permission_classes = [AllowAny]
    throttle_scope = "comments"

    def get_throttles(self):
        # Only posting is rate limited; reading the discussion isn't.
        return [ScopedRateThrottle()] if self.request.method == "POST" else []

    @extend_schema(responses=inline_serializer("LessonComments", {
        "count": serializers.IntegerField(), "results": LessonCommentSerializer(many=True),
    }))
    def get(self, request, pk):
        lesson = _lesson(pk)
        check_read_access(request.user, lesson)
        threads = (
            LessonComment.objects.filter(lesson=lesson, parent__isnull=True)
            .select_related("author")
            .prefetch_related("replies__author")[:MAX_THREADS]
        )
        return Response({
            "count": LessonComment.objects.filter(lesson=lesson).count(),
            "results": LessonCommentSerializer(threads, many=True, context=_context(request, lesson)).data,
        })

    @extend_schema(request=CommentInputSerializer, responses={201: LessonCommentSerializer})
    def post(self, request, pk):
        lesson = _lesson(pk)
        check_post_access(request.user, lesson)
        data = CommentInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        parent = None
        if parent_id := data.validated_data.get("parent"):
            parent = get_object_or_404(LessonComment, pk=parent_id, lesson=lesson)
            parent = parent.parent or parent  # replies stay one level deep
        comment = LessonComment.objects.create(
            lesson=lesson, author=request.user, parent=parent, body=data.validated_data["body"],
        )
        return Response(LessonCommentSerializer(comment, context=_context(request, lesson)).data,
                        status=status.HTTP_201_CREATED)


class LessonCommentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={204: None})
    def delete(self, request, pk):
        comment = get_object_or_404(LessonComment.objects.select_related("lesson__module__course"), pk=pk)
        if comment.author_id != request.user.pk and not can_moderate(request.user, comment.lesson):
            raise PermissionDenied("You can only delete your own comments.")
        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class LessonViewView(APIView):
    """Count this student as a viewer of the lesson (once per student). Returns the view count."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses=inline_serializer("LessonViews", {"views": serializers.IntegerField()}))
    def post(self, request, pk):
        lesson = _lesson(pk)
        check_read_access(request.user, lesson)
        if request.user.is_student:  # teachers and admins checking a lesson don't count
            LessonView.objects.get_or_create(lesson=lesson, student=request.user)
        return Response({"views": LessonView.objects.filter(lesson=lesson).count()})
