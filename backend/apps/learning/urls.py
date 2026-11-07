from django.urls import path

from .comments import LessonCommentDetailView, LessonCommentsView, LessonViewView
from .quizzes import QuizAttemptView, QuizDetailView
from .views import LearnCourseView, LearningSummaryView, LessonDetailView, LessonProgressView

urlpatterns = [
    path("lessons/<int:pk>/comments/", LessonCommentsView.as_view(), name="lesson-comments"),
    path("lessons/<int:pk>/view/", LessonViewView.as_view(), name="lesson-view"),
    path("comments/<int:pk>/", LessonCommentDetailView.as_view(), name="lesson-comment-detail"),
    path("quizzes/<int:pk>/", QuizDetailView.as_view(), name="quiz-detail"),
    path("quizzes/<int:pk>/attempt/", QuizAttemptView.as_view(), name="quiz-attempt"),
    path("summary/", LearningSummaryView.as_view(), name="learning-summary"),
    path("courses/<slug:slug>/", LearnCourseView.as_view(), name="learn-course"),
    path("lessons/<int:pk>/", LessonDetailView.as_view(), name="learn-lesson"),
    path("lessons/<int:pk>/progress/", LessonProgressView.as_view(), name="lesson-progress"),
]
