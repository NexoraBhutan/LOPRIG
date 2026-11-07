"""Chapter quizzes for students.

The questions go out without their answers; the answers and explanations are only revealed in the
graded result of an attempt. Students in the course can attempt (best attempt counts); the course's
teacher and admins can open a quiz to check it, but their tries aren't recorded.
"""
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.exceptions import NotAuthenticated, PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.courses.models import Quiz, QuizQuestion
from apps.users.permissions import IsStudent

from . import services
from .models import QuizAttempt


def _quiz(pk) -> Quiz:
    return get_object_or_404(Quiz.objects.select_related("module__course"), pk=pk)


def _can_moderate_quiz(user, quiz: Quiz) -> bool:
    course = quiz.module.course
    return user.is_authenticated and (user.is_platform_admin or course.teacher_id == user.pk)


class QuizQuestionPublicSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    kind = serializers.ChoiceField(choices=QuizQuestion.Kind.choices)
    prompt = serializers.CharField()
    options = serializers.ListField(child=serializers.CharField())


class QuizAnswersSerializer(serializers.Serializer):
    """One answer per question: an option index (or null) for multiple choice, text for written ones."""

    answers = serializers.ListField(child=serializers.JSONField(allow_null=True), max_length=200)

    def validate_answers(self, answers):
        for a in answers:
            if isinstance(a, bool) or (a is not None and not isinstance(a, (int, str))):
                raise serializers.ValidationError("Each answer is an option number or your written answer.")
            if isinstance(a, str) and len(a) > services.WRITTEN_ANSWER_MAX:
                raise serializers.ValidationError(
                    f"Keep each written answer under {services.WRITTEN_ANSWER_MAX} characters.")
        return answers


class QuizDetailView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(responses=inline_serializer("StudentQuiz", {
        "id": serializers.IntegerField(), "title": serializers.CharField(), "pass_percent": serializers.IntegerField(),
        "chapter": serializers.CharField(), "questions": QuizQuestionPublicSerializer(many=True),
        "best_score": serializers.IntegerField(allow_null=True), "passed": serializers.BooleanField(),
        "attempts": serializers.IntegerField(), "pending": serializers.BooleanField(),
        "latest": serializers.DictField(allow_null=True),
    }))
    def get(self, request, pk):
        quiz = _quiz(pk)
        user = request.user
        enrollment = None
        if not _can_moderate_quiz(user, quiz):
            course = quiz.module.course
            if user.is_authenticated and user.is_student:
                enrollment = services.require_access(user, course)
            elif not services.is_open_course(course):
                if not user.is_authenticated:
                    raise NotAuthenticated()
                raise PermissionDenied("Only students in this course can take its quizzes.")
        result = services.quiz_results(enrollment).get(quiz.id, {})
        # Quizzes with written answers come back to the student later: show their latest marked
        # (or still waiting) attempt with its feedback.
        latest = None
        if enrollment is not None:
            last = (QuizAttempt.objects.filter(enrollment=enrollment, quiz=quiz)
                    .exclude(status=QuizAttempt.Status.GRADED).select_related("quiz").first())
            latest = services.attempt_payload(last) if last else None
        return Response({
            "id": quiz.id,
            "title": quiz.title,
            "pass_percent": quiz.pass_percent,
            "chapter": quiz.module.title,
            "questions": [{"id": q.id, "kind": q.kind, "prompt": q.prompt, "options": q.options}
                          for q in quiz.questions.all()],
            "best_score": result.get("best_score"),
            "passed": result.get("passed", False),
            "attempts": result.get("attempts", 0),
            "pending": result.get("pending", False),
            "latest": latest,
        })


class QuizAttemptView(APIView):
    permission_classes = [IsStudent]

    @extend_schema(request=QuizAnswersSerializer, responses=inline_serializer("QuizResult", {
        "id": serializers.IntegerField(), "status": serializers.CharField(),
        "score": serializers.IntegerField(allow_null=True), "passed": serializers.BooleanField(),
        "correct_count": serializers.IntegerField(), "total": serializers.IntegerField(),
        "pass_percent": serializers.IntegerField(), "results": serializers.ListField(),
        "course_progress": serializers.DictField(), "course_completed": serializers.BooleanField(),
        "certificate": serializers.CharField(allow_null=True),
    }))
    def post(self, request, pk):
        quiz = _quiz(pk)
        data = QuizAnswersSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        attempt, progress, certificate = services.submit_quiz(request.user, quiz, data.validated_data["answers"])
        return Response({
            **services.attempt_payload(attempt),
            "course_progress": progress.as_dict(),
            "course_completed": progress.finished,
            "certificate": certificate.code if certificate else None,
        })
