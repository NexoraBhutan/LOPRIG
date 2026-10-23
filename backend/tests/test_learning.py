from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.certificates.models import Certificate
from apps.enrollments.models import Enrollment
from apps.learning.models import ActivityDay
from apps.learning.services import day_streak
from apps.notifications.models import Notification

from .factories import lessons_of, make_course, make_user


class LessonAccessTests(APITestCase):
    def setUp(self):
        self.student = make_user()
        self.course = make_course("python-101", price="500")
        self.preview, self.locked, _ = lessons_of(self.course)

    def test_preview_lesson_is_public(self):
        res = self.client.get(f"/api/v1/learning/lessons/{self.preview.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["video_url"])

    def test_locked_lesson_requires_enrollment(self):
        self.assertEqual(self.client.get(f"/api/v1/learning/lessons/{self.locked.id}/").status_code, 401)
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get(f"/api/v1/learning/lessons/{self.locked.id}/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/learning/courses/python-101/").status_code, 403)
        res = self.client.post(f"/api/v1/learning/lessons/{self.locked.id}/progress/", {"completed": True})
        self.assertEqual(res.status_code, 403)


class ProgressTests(APITestCase):
    def setUp(self):
        self.student = make_user()
        self.course = make_course("python-101", price="0", lessons=3)
        self.lessons = lessons_of(self.course)
        self.client.force_authenticate(self.student)
        self.client.post("/api/v1/courses/python-101/enroll/")

    def progress(self, lesson, **data):
        return self.client.post(f"/api/v1/learning/lessons/{lesson.id}/progress/", data)

    def test_learn_view_returns_content_and_progress(self):
        res = self.client.get("/api/v1/learning/courses/python-101/")
        self.assertEqual(res.status_code, 200)
        lesson = res.data["modules"][0]["lessons"][1]
        self.assertEqual(lesson["body"], "Secret lesson notes")
        self.assertEqual(res.data["progress"], {"completed_lessons": 0, "total_lessons": 3, "percent": 0})

    def test_resume_position_is_saved_and_capped(self):
        res = self.progress(self.lessons[1], position_seconds=9999)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["position_seconds"], 300)
        self.assertFalse(res.data["completed"])
        learn = self.client.get("/api/v1/learning/courses/python-101/").data
        self.assertEqual(learn["last_lesson"], self.lessons[1].id)
        self.assertEqual(learn["modules"][0]["lessons"][1]["position_seconds"], 300)

    def test_completing_all_lessons_issues_one_certificate(self):
        first = self.progress(self.lessons[0], completed=True)
        self.assertEqual(first.data["course_progress"]["percent"], 33)
        self.assertIsNone(first.data["certificate"])
        self.progress(self.lessons[1], completed=True)
        last = self.progress(self.lessons[2], completed=True)

        self.assertTrue(last.data["course_completed"])
        self.assertIsNotNone(last.data["certificate"])
        enrollment = Enrollment.objects.get(student=self.student, course=self.course)
        self.assertEqual(enrollment.status, Enrollment.Status.COMPLETED)
        self.assertEqual(Certificate.objects.filter(student=self.student).count(), 1)
        self.assertEqual(Notification.objects.filter(user=self.student, kind="COURSE_COMPLETED").count(), 1)

        # Marking again changes nothing and never issues a second certificate.
        self.progress(self.lessons[2], completed=True)
        self.assertEqual(Certificate.objects.filter(student=self.student).count(), 1)

        my_courses = self.client.get("/api/v1/enrollments/?status=COMPLETED").data["results"]
        self.assertEqual(my_courses[0]["progress"], 100)

    def test_summary_counts_xp_and_streak(self):
        for lesson in self.lessons:
            self.progress(lesson, completed=True)
        summary = self.client.get("/api/v1/learning/summary/").data
        self.assertEqual(summary["completed_lessons"], 3)
        self.assertEqual(summary["completed_courses"], 1)
        self.assertEqual(summary["xp"], 3 * 10 + 100)
        self.assertEqual(summary["streak"], 1)
        self.assertEqual(summary["certificates"], 1)


class StreakTests(APITestCase):
    def setUp(self):
        self.student = make_user()
        self.today = timezone.localdate()

    def add_days(self, *offsets):
        for offset in offsets:
            ActivityDay.objects.create(student=self.student, day=self.today - timedelta(days=offset))

    def test_consecutive_days(self):
        self.add_days(0, 1, 2, 4)
        self.assertEqual(day_streak(self.student, self.today), 3)

    def test_streak_survives_until_end_of_today(self):
        self.add_days(1, 2)
        self.assertEqual(day_streak(self.student, self.today), 2)

    def test_missed_day_resets(self):
        self.add_days(2, 3)
        self.assertEqual(day_streak(self.student, self.today), 0)
