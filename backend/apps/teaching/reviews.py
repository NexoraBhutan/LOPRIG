"""Marking written answers to chapter tests.

A test with written questions waits for its course's teacher: they read each answer, mark it
correct or not, add feedback, and the student's score (and maybe their certificate) follows.
"""
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.learning import services
from apps.learning.models import QuizAttempt
from apps.users.permissions import IsTeacher

REVIEWED_LIST_LIMIT = 50


def my_attempts(user):
    return QuizAttempt.objects.filter(quiz__module__course__teacher=user).exclude(
        status=QuizAttempt.Status.GRADED,
    ).select_related("quiz__module__course", "enrollment__student")


def _summary(a: QuizAttempt) -> dict:
    student = a.enrollment.student
    return {
        "id": a.id,
        "status": a.status,
        "student": {"name": student.name, "email": student.email, "avatar": student.avatar_url},
        "course": {"id": a.quiz.module.course.slug, "title": a.quiz.module.course.title},
        "chapter": a.quiz.module.title,
        "quiz": a.quiz.title,
        "written_count": sum(1 for q in a.questions if q["kind"] == "WRITTEN"),
        "score": a.score,
        "passed": a.passed,
        "submitted_at": a.created_at,
        "reviewed_at": a.reviewed_at,
    }


class MarkSerializer(serializers.Serializer):
    question = serializers.IntegerField()
    correct = serializers.BooleanField()
    feedback = serializers.CharField(max_length=1000, required=False, allow_blank=True, trim_whitespace=True)


class ReviewInputSerializer(serializers.Serializer):
    marks = MarkSerializer(many=True, max_length=200)
    feedback = serializers.CharField(max_length=2000, required=False, allow_blank=True, trim_whitespace=True)


class ReviewListView(APIView):
    """Answers waiting for this teacher (oldest first), and the most recently marked ones."""

    permission_classes = [IsTeacher]

    @extend_schema(responses=inline_serializer("TeacherReviews", {
        "pending": serializers.ListField(child=serializers.DictField()),
        "reviewed": serializers.ListField(child=serializers.DictField()),
    }))
    def get(self, request):
        attempts = my_attempts(request.user)
        pending = attempts.filter(status=QuizAttempt.Status.PENDING).order_by("created_at")
        reviewed = attempts.filter(status=QuizAttempt.Status.REVIEWED).order_by("-reviewed_at")[:REVIEWED_LIST_LIMIT]
        return Response({"pending": [_summary(a) for a in pending], "reviewed": [_summary(a) for a in reviewed]})


class ReviewDetailView(APIView):
    """GET: one student's answers next to the questions and model answers. POST: save the marks."""

    permission_classes = [IsTeacher]

    def _attempt(self, request, pk) -> QuizAttempt:
        return get_object_or_404(my_attempts(request.user), pk=pk)

    def _detail(self, attempt: QuizAttempt) -> dict:
        return {
            **_summary(attempt),
            "pass_percent": attempt.quiz.pass_percent,
            "feedback": attempt.feedback,
            "questions": [
                {**q, "answer": a, "mark": attempt.marks.get(str(q["id"]))}
                for q, a in zip(attempt.questions, attempt.answers)
            ],
        }

    def get(self, request, pk):
        return Response(self._detail(self._attempt(request, pk)))

    @extend_schema(request=ReviewInputSerializer)
    def post(self, request, pk):
        attempt = self._attempt(request, pk)
        data = ReviewInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        marks = {m["question"]: {"correct": m["correct"], "feedback": m.get("feedback", "")}
                 for m in data.validated_data["marks"]}
        attempt, certificate = services.review_attempt(
            request.user, attempt, marks, data.validated_data.get("feedback", ""),
        )
        return Response({**self._detail(attempt), "certificate": certificate.code if certificate else None})
