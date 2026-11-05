import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.courses.models import Course

from .factories import make_course, make_teacher

MEDIA = tempfile.mkdtemp()
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def png(name="cover.png"):
    return SimpleUploadedFile(name, PNG, content_type="image/png")


@override_settings(MEDIA_ROOT=MEDIA)
class CourseCoverTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.teacher = make_teacher()
        self.course = make_course("cover-course", status=Course.Status.PUBLISHED, teacher=self.teacher)
        self.client.force_authenticate(self.teacher)
        self.url = f"/api/v1/teach/courses/{self.course.slug}/cover/"

    def test_upload_sets_the_card_image_everywhere(self):
        res = self.client.post(self.url, {"image": png()}, format="multipart")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertRegex(res.data["thumbnail_url"], r"^http://testserver/media/course-covers/[0-9a-f]{32}\.png$")

        self.client.force_authenticate(None)
        public = self.client.get(f"/api/v1/courses/{self.course.slug}/")
        self.assertIn("/media/course-covers/", public.data["thumbnail_url"])

    def test_replacing_deletes_the_old_file_and_delete_clears_it(self):
        self.client.post(self.url, {"image": png()}, format="multipart")
        self.course.refresh_from_db()
        old = self.course.cover_image.name
        self.client.post(self.url, {"image": png()}, format="multipart")
        self.assertFalse(self.course.cover_image.storage.exists(old))

        res = self.client.delete(self.url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["thumbnail_url"], "")

    def test_rejects_files_that_are_not_images(self):
        fake = SimpleUploadedFile("cover.png", b"<script>alert(1)</script>", content_type="image/png")
        res = self.client.post(self.url, {"image": fake}, format="multipart")
        self.assertEqual(res.status_code, 400)
        self.assertIn("image", res.data)

    def test_other_teachers_cannot_change_my_cover(self):
        self.client.force_authenticate(make_teacher(email="other@example.com"))
        res = self.client.post(self.url, {"image": png()}, format="multipart")
        self.assertEqual(res.status_code, 404)
