from unittest import mock

from django.test import override_settings
from rest_framework.test import APITestCase

from apps.courses.models import Lesson
from apps.enrollments.models import Enrollment

from .factories import lessons_of, make_course, make_teacher, make_user

BUNNY_VIDEO = {"hasMP4Fallback": True, "availableResolutions": "240p,360p,480p,720p"}


@override_settings(BUNNY_STREAM_LIBRARY_ID="123", BUNNY_STREAM_API_KEY="k", BUNNY_STREAM_TOKEN_KEY="secret",
                   BUNNY_STREAM_CDN_HOSTNAME="vz-test.b-cdn.net", OFFLINE_DOWNLOAD_DAYS=14)
class OfflineDownloadTests(APITestCase):
    """Students with access can save a lesson for offline viewing inside Lop-rig; nobody else can."""

    def setUp(self):
        self.course = make_course("paid-course", price="499", lessons=1, teacher=make_teacher())
        self.lesson = lessons_of(self.course)[0]
        Lesson.objects.filter(pk=self.lesson.pk).update(video_id="abc-123", video_status=Lesson.VideoStatus.READY)
        self.student = make_user()
        self.url = f"/api/v1/learning/lessons/{self.lesson.pk}/download/"

    def download(self, user):
        self.client.force_authenticate(user)
        with mock.patch("apps.courses.video._request", return_value=BUNNY_VIDEO):
            return self.client.post(self.url)

    def test_enrolled_student_gets_a_short_lived_signed_link(self):
        Enrollment.objects.create(student=self.student, course=self.course, status=Enrollment.Status.ACTIVE)
        res = self.download(self.student)
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data["url"].startswith("https://vz-test.b-cdn.net/abc-123/play_480p.mp4?token="))
        self.assertIn("&expires=", res.data["url"])
        self.assertEqual(res.data["resolution"], "480p")

    def test_students_without_access_cannot_download(self):
        self.assertEqual(self.download(self.student).status_code, 403)

    def test_teachers_cannot_use_the_student_download(self):
        self.assertEqual(self.download(make_teacher(email="t2@example.com")).status_code, 403)

    @override_settings(BUNNY_STREAM_CDN_HOSTNAME="")
    def test_not_set_up_says_so(self):
        Enrollment.objects.create(student=self.student, course=self.course, status=Enrollment.Status.ACTIVE)
        res = self.download(self.student)
        self.assertEqual(res.status_code, 503)
        self.assertIn("aren't set up", res.data["detail"])
