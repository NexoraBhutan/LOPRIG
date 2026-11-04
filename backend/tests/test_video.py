import hashlib
import hmac
import json
from unittest import mock
from urllib.parse import parse_qs, urlparse

from django.test import override_settings
from rest_framework.test import APITestCase

from apps.courses import video
from apps.courses.models import Course, Lesson
from apps.enrollments.models import Enrollment

from .factories import lessons_of, make_course, make_teacher, make_user

BUNNY = dict(
    BUNNY_STREAM_LIBRARY_ID="12345",
    BUNNY_STREAM_API_KEY="api-key",
    BUNNY_STREAM_TOKEN_KEY="token-key",
    BUNNY_STREAM_READONLY_API_KEY="",
)


@override_settings(**BUNNY)
class TeacherVideoUploadTests(APITestCase):
    def setUp(self):
        self.teacher = make_teacher()
        self.course = make_course("draft-course", status=Course.Status.DRAFT, teacher=self.teacher, lessons=1)
        self.lesson = lessons_of(self.course)[0]
        self.client.force_authenticate(self.teacher)

    def upload(self, lesson=None):
        return self.client.post(f"/api/v1/teach/lessons/{(lesson or self.lesson).id}/video/upload/")

    @mock.patch.object(video, "create_video", return_value="vid-1")
    def test_upload_returns_a_signed_ticket_without_the_api_key(self, _create):
        res = self.upload()
        self.assertEqual(res.status_code, 200, res.data)
        ticket = res.data["upload"]
        expected = hashlib.sha256(f"12345api-key{ticket['expires']}vid-1".encode()).hexdigest()
        self.assertEqual(ticket["signature"], expected)
        self.assertEqual(ticket["endpoint"], "https://video.bunnycdn.com/tusupload")
        self.assertNotIn("api-key", json.dumps(res.data))
        self.lesson.refresh_from_db()
        self.assertEqual((self.lesson.video_id, self.lesson.video_status, self.lesson.video_url), ("vid-1", "UPLOADING", ""))
        self.assertTrue(res.data["lesson"]["has_upload"])

    def test_upload_reports_when_bunny_is_not_set_up(self):
        with override_settings(BUNNY_STREAM_LIBRARY_ID=""):
            res = self.upload()
        self.assertEqual(res.status_code, 503)
        self.assertIn("YouTube or Vimeo", str(res.data["detail"]))

    @mock.patch.object(video, "create_video", return_value="vid-1")
    def test_other_teachers_cannot_upload_to_my_lesson(self, _create):
        self.client.force_authenticate(make_teacher(email="other@example.com"))
        self.assertEqual(self.upload().status_code, 404)

    @mock.patch.object(video, "delete_video")
    @mock.patch.object(video, "create_video", side_effect=["vid-1", "vid-2"])
    def test_uploading_again_replaces_and_deletes_the_old_video(self, _create, delete):
        self.upload()
        self.upload()
        delete.assert_called_with("vid-1")
        self.lesson.refresh_from_db()
        self.assertEqual(self.lesson.video_id, "vid-2")

    @mock.patch.object(video, "fetch_status", return_value=("READY", 754))
    @mock.patch.object(video, "create_video", return_value="vid-1")
    def test_status_check_fills_in_duration_and_teacher_can_preview(self, _create, _fetch):
        self.upload()
        res = self.client.post(f"/api/v1/teach/lessons/{self.lesson.id}/video/")
        self.assertEqual(res.data["video_status"], "READY")
        self.assertEqual(res.data["duration_seconds"], 754)
        self.assertEqual(res.data["playback"]["source"], "BUNNY")

    @mock.patch.object(video, "youtube_embed_problem", return_value="")
    @mock.patch.object(video, "delete_video")
    @mock.patch.object(video, "create_video", return_value="vid-1")
    def test_pasting_a_link_or_removing_drops_the_upload(self, _create, delete, _youtube):
        self.upload()
        res = self.client.patch(f"/api/v1/teach/lessons/{self.lesson.id}/", {"video_url": "https://youtu.be/dQw4w9WgXcQ"})
        self.assertFalse(res.data["has_upload"])
        self.assertEqual(res.data["playback"]["source"], "YOUTUBE")
        delete.assert_called_with("vid-1")

        self.upload()
        res = self.client.delete(f"/api/v1/teach/lessons/{self.lesson.id}/video/")
        self.assertFalse(res.data["has_upload"])

    @mock.patch.object(video, "create_video", return_value="vid-1")
    def test_cannot_submit_while_a_video_is_processing(self, _create):
        self.course.description = "A thorough description that is long enough to submit."
        self.course.what_you_learn = ["Something"]
        self.course.save()
        self.upload()
        res = self.client.post(f"/api/v1/teach/courses/{self.course.slug}/submit/")
        self.assertEqual(res.status_code, 400)
        self.assertIn("finish uploading", str(res.data))

    @mock.patch.object(video, "delete_video")
    def test_deleting_a_lesson_deletes_its_video_from_bunny(self, delete):
        Lesson.objects.filter(pk=self.lesson.pk).update(video_id="vid-9", video_status="READY")
        with self.captureOnCommitCallbacks(execute=True):
            self.client.delete(f"/api/v1/teach/lessons/{self.lesson.id}/")
        delete.assert_called_once_with("vid-9")


@override_settings(**BUNNY)
class StudentPlaybackTests(APITestCase):
    def setUp(self):
        self.course = make_course("paid", price="500", lessons=2)
        self.lesson = lessons_of(self.course)[1]
        Lesson.objects.filter(pk=self.lesson.pk).update(video_id="vid-1", video_status="READY", video_url="")
        self.student = make_user()
        Enrollment.objects.create(student=self.student, course=self.course, status=Enrollment.Status.ACTIVE)
        self.client.force_authenticate(self.student)

    def test_enrolled_student_gets_a_short_lived_signed_link(self):
        res = self.client.get(f"/api/v1/learning/lessons/{self.lesson.id}/")
        self.assertEqual(res.data["video"]["source"], "BUNNY")
        url = urlparse(res.data["video"]["url"])
        self.assertEqual(url.path, "/embed/12345/vid-1")
        query = parse_qs(url.query)
        expected = hashlib.sha256(f"token-keyvid-1{query['expires'][0]}".encode()).hexdigest()
        self.assertEqual(query["token"][0], expected)

    def test_unenrolled_student_gets_nothing(self):
        self.client.force_authenticate(make_user(email="other@example.com"))
        self.assertEqual(self.client.get(f"/api/v1/learning/lessons/{self.lesson.id}/").status_code, 403)

    def test_video_still_processing_is_not_playable(self):
        Lesson.objects.filter(pk=self.lesson.pk).update(video_status="PROCESSING")
        res = self.client.get(f"/api/v1/learning/lessons/{self.lesson.id}/")
        self.assertEqual(res.data["video"], {"source": "", "url": ""})


@override_settings(**{**BUNNY, "BUNNY_STREAM_READONLY_API_KEY": "read-key"})
class BunnyWebhookTests(APITestCase):
    url = "/api/v1/webhooks/bunny-stream/"

    def setUp(self):
        self.lesson = lessons_of(make_course("c", lessons=1))[0]
        Lesson.objects.filter(pk=self.lesson.pk).update(video_id="vid-1", video_status="PROCESSING")

    def post(self, body: bytes, signature: str):
        return self.client.post(self.url, body, content_type="application/json",
                                HTTP_X_BUNNYSTREAM_SIGNATURE_VERSION="v1",
                                HTTP_X_BUNNYSTREAM_SIGNATURE_ALGORITHM="hmac-sha256",
                                HTTP_X_BUNNYSTREAM_SIGNATURE=signature)

    @mock.patch.object(video, "fetch_status", return_value=("READY", 300))
    def test_signed_webhook_refreshes_status_from_bunny(self, fetch):
        body = json.dumps({"VideoLibraryId": 12345, "VideoGuid": "vid-1", "Status": 3}).encode()
        res = self.post(body, hmac.new(b"read-key", body, hashlib.sha256).hexdigest())
        self.assertEqual(res.status_code, 200)
        fetch.assert_called_once_with("vid-1")
        self.lesson.refresh_from_db()
        self.assertEqual(self.lesson.video_status, "READY")

    @mock.patch.object(video, "fetch_status")
    def test_bad_signature_is_rejected(self, fetch):
        res = self.post(json.dumps({"VideoGuid": "vid-1"}).encode(), "0" * 64)
        self.assertEqual(res.status_code, 401)
        fetch.assert_not_called()


@override_settings(**BUNNY)
class YouTubeLinkCheckTests(APITestCase):
    def setUp(self):
        self.teacher = make_teacher()
        course = make_course("draft-course", status=Course.Status.DRAFT, teacher=self.teacher, lessons=1)
        self.lesson = lessons_of(course)[0]
        self.client.force_authenticate(self.teacher)

    def save_link(self, url):
        return self.client.patch(f"/api/v1/teach/lessons/{self.lesson.id}/", {"video_url": url})

    def test_blocked_youtube_video_is_refused_with_a_reason(self):
        with mock.patch.object(video, "youtube_embed_problem", return_value="The owner blocks it.") as check:
            res = self.save_link("https://youtu.be/dQw4w9WgXcQ")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["video_url"], ["The owner blocks it."])
        check.assert_called_once()

    def test_embeddable_or_unreachable_youtube_is_accepted(self):
        with mock.patch.object(video, "youtube_embed_problem", return_value=""):
            self.assertEqual(self.save_link("https://youtu.be/dQw4w9WgXcQ").status_code, 200)

    def test_oembed_answers_are_translated(self):
        import urllib.error

        def fail(code):
            return mock.patch("urllib.request.urlopen", side_effect=urllib.error.HTTPError("u", code, "x", {}, None))

        with fail(401):
            self.assertIn("doesn't allow", video.youtube_embed_problem("https://youtu.be/dQw4w9WgXcQ"))
        with fail(404):
            self.assertIn("private, deleted", video.youtube_embed_problem("https://youtu.be/dQw4w9WgXcQ"))
        with mock.patch("urllib.request.urlopen", side_effect=urllib.error.URLError("offline")):
            self.assertEqual(video.youtube_embed_problem("https://youtu.be/dQw4w9WgXcQ"), "")
        self.assertEqual(video.youtube_embed_problem("https://vimeo.com/1"), "")
