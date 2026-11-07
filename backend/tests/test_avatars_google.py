import io
import json
import shutil
import tempfile
import time
import urllib.error
from unittest import mock

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.users.models import User

from .factories import make_teacher, make_user

MEDIA = tempfile.mkdtemp()
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
CLIENT_ID = "123-test.apps.googleusercontent.com"
PICTURE = "https://lh3.googleusercontent.com/a/abc=s96-c"


def google_claims(**overrides):
    return {
        "aud": CLIENT_ID, "iss": "https://accounts.google.com", "email": "karma@gmail.com",
        "email_verified": "true", "exp": str(int(time.time()) + 600), "name": "Karma Wangdi",
        "picture": PICTURE, **overrides,
    }


def google_says(claims):
    return mock.patch("urllib.request.urlopen", return_value=io.BytesIO(json.dumps(claims).encode()))


@override_settings(MEDIA_ROOT=MEDIA)
class AvatarUploadTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.user = make_user(email="photo@example.com")
        self.client.force_authenticate(self.user)

    def upload(self, content=PNG):
        return self.client.post("/api/v1/users/me/avatar/",
                                {"image": SimpleUploadedFile("me.png", content, content_type="image/png")},
                                format="multipart")

    def test_upload_shows_everywhere_and_beats_the_google_picture(self):
        self.user.google_picture = PICTURE
        self.user.save(update_fields=["google_picture"])
        res = self.upload()
        self.assertEqual(res.status_code, 200, res.data)
        self.assertRegex(res.data["avatar"], r"^/media/avatars/[0-9a-f]{32}\.png$")
        self.assertEqual(self.client.get("/api/v1/users/me/").data["avatar"], res.data["avatar"])

        removed = self.client.delete("/api/v1/users/me/avatar/")
        self.assertEqual(removed.data["avatar"], PICTURE)  # falls back to Google's picture

    def test_rejects_non_images(self):
        res = self.upload(b"<svg onload=alert(1)>")
        self.assertEqual(res.status_code, 400)

    def test_needs_login(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.upload().status_code, 401)


class LogoutEverywhereTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_ends_every_session(self):
        user = make_user(email="sessions@example.com", password="Strong-Pass-123")
        logins = [self.client.post("/api/v1/auth/login/", {"email": user.email, "password": "Strong-Pass-123"})
                  for _ in range(2)]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {logins[0].data['access']}")
        self.assertEqual(self.client.post("/api/v1/auth/logout-all/").status_code, 204)
        self.client.credentials()
        for login in logins:  # both devices' refresh tokens stop working
            res = self.client.post("/api/v1/auth/refresh/", {"refresh": login.data["refresh"]})
            self.assertEqual(res.status_code, 401)

    def test_needs_login(self):
        self.assertEqual(self.client.post("/api/v1/auth/logout-all/").status_code, 401)


@override_settings(GOOGLE_CLIENT_ID=CLIENT_ID)
class GoogleSignInTests(APITestCase):
    def setUp(self):
        cache.clear()  # sign-in is rate limited

    def tearDown(self):
        cache.clear()  # don't use up the limit for later test files

    def sign_in(self):
        return self.client.post("/api/v1/auth/google/", {"credential": "fake.jwt.token"})

    def test_new_email_creates_a_student_with_the_google_picture(self):
        with google_says(google_claims()):
            res = self.sign_in()
        self.assertEqual(res.status_code, 201, res.data)
        self.assertIn("access", res.data)
        self.assertEqual(res.data["user"]["role"], "STUDENT")
        self.assertEqual(res.data["user"]["name"], "Karma Wangdi")
        self.assertEqual(res.data["user"]["avatar"], "https://lh3.googleusercontent.com/a/abc=s256-c")
        self.assertFalse(User.objects.get(email="karma@gmail.com").has_usable_password())

    def test_existing_teacher_signs_in_and_gets_the_picture(self):
        teacher = make_teacher(email="karma@gmail.com")
        with google_says(google_claims(email="Karma@Gmail.com")):
            res = self.sign_in()
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["user"]["id"], teacher.pk)
        self.assertEqual(res.data["user"]["role"], "TEACHER")
        self.assertTrue(res.data["user"]["avatar"].startswith("https://lh3.googleusercontent.com/"))

    def test_rejects_tokens_for_another_app_or_unverified_email(self):
        for bad in (google_claims(aud="someone-else"), google_claims(email_verified="false"),
                    google_claims(exp=str(int(time.time()) - 5)), google_claims(iss="evil.example")):
            with google_says(bad):
                self.assertEqual(self.sign_in().status_code, 401)
        self.assertFalse(User.objects.filter(email="karma@gmail.com").exists())

    def test_rejects_tokens_google_says_are_invalid(self):
        error = urllib.error.HTTPError("u", 400, "bad", {}, io.BytesIO(b"{}"))
        with mock.patch("urllib.request.urlopen", side_effect=error):
            self.assertEqual(self.sign_in().status_code, 401)

    def test_deactivated_and_site_admin_accounts_are_refused(self):
        teacher = make_teacher(email="karma@gmail.com")
        User.objects.filter(pk=teacher.pk).update(is_active=False)
        with google_says(google_claims()):
            self.assertEqual(self.sign_in().status_code, 401)
        User.objects.create_superuser(email="root@gmail.com", password="x", name="Root")
        with google_says(google_claims(email="root@gmail.com")):
            self.assertEqual(self.sign_in().status_code, 401)

    def test_google_accounts_report_no_password_until_they_set_one(self):
        with google_says(google_claims()):
            res = self.sign_in()
        self.assertIs(res.data["user"]["has_password"], False)
        self.assertIsNone(res.data["user"]["password_changed_at"])

    def test_hidden_when_not_configured(self):
        with override_settings(GOOGLE_CLIENT_ID=""):
            self.assertEqual(self.sign_in().status_code, 503)
            self.assertEqual(self.client.get("/api/v1/config/").data["google_client_id"], "")
