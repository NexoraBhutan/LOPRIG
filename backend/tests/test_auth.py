import re
from datetime import timedelta

from django.core import mail
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase as BaseAPITestCase

from apps.users.models import PasswordResetCode, User

from .factories import PASSWORD, make_user


class APITestCase(BaseAPITestCase):
    """Auth endpoints are rate limited; start every test with a fresh limiter."""

    def setUp(self):
        cache.clear()
        super().setUp()


class RegisterTests(APITestCase):
    url = "/api/v1/auth/register/"

    def test_register_creates_student_and_returns_tokens(self):
        res = self.client.post(self.url, {"name": "Pema", "email": "Pema@Example.com", "password": PASSWORD})
        self.assertEqual(res.status_code, 201)
        self.assertIn("access", res.data)
        self.assertIn("refresh", res.data)
        self.assertEqual(res.data["user"]["email"], "pema@example.com")
        self.assertEqual(res.data["user"]["role"], "STUDENT")
        user = User.objects.get(email="pema@example.com")
        self.assertNotEqual(user.password, PASSWORD)  # stored as a hash
        self.assertTrue(user.check_password(PASSWORD))

    def test_cannot_register_as_admin(self):
        res = self.client.post(self.url, {"name": "X", "email": "x@example.com", "password": PASSWORD, "role": "ADMIN"})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(User.objects.get(email="x@example.com").role, User.Role.STUDENT)

    def test_duplicate_email_is_rejected_case_insensitively(self):
        make_user(email="taken@example.com")
        res = self.client.post(self.url, {"name": "Y", "email": "TAKEN@example.com", "password": PASSWORD})
        self.assertEqual(res.status_code, 400)
        self.assertIn("email", res.data)

    def test_weak_password_is_rejected(self):
        res = self.client.post(self.url, {"name": "Z", "email": "z@example.com", "password": "123"})
        self.assertEqual(res.status_code, 400)
        self.assertIn("password", res.data)

    def test_rate_limit_blocks_brute_force(self):
        codes = [
            self.client.post("/api/v1/auth/login/", {"email": "x@example.com", "password": "guess"}).status_code
            for _ in range(11)
        ]
        self.assertEqual(codes[:10], [401] * 10)
        self.assertEqual(codes[10], 429)


class LoginLogoutTests(APITestCase):
    def setUp(self):
        super().setUp()
        self.user = make_user(email="karma@example.com")

    def login(self, email="karma@example.com", password=PASSWORD):
        return self.client.post("/api/v1/auth/login/", {"email": email, "password": password})

    def test_login_returns_tokens_and_user(self):
        res = self.login(email="KARMA@example.com ")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["user"]["id"], self.user.id)

    def test_wrong_password(self):
        self.assertEqual(self.login(password="nope-nope-nope").status_code, 401)

    def test_access_token_unlocks_profile(self):
        self.assertEqual(self.client.get("/api/v1/users/me/").status_code, 401)
        token = self.login().data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        res = self.client.get("/api/v1/users/me/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["email"], "karma@example.com")

    def test_logout_blacklists_refresh_token(self):
        tokens = self.login().data
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        self.assertEqual(self.client.post("/api/v1/auth/logout/", {"refresh": tokens["refresh"]}).status_code, 204)
        res = self.client.post("/api/v1/auth/refresh/", {"refresh": tokens["refresh"]})
        self.assertEqual(res.status_code, 401)

    def test_cannot_logout_someone_elses_token(self):
        make_user(email="other@example.com")
        other_refresh = self.login(email="other@example.com").data["refresh"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.login().data['access']}")
        res = self.client.post("/api/v1/auth/logout/", {"refresh": other_refresh})
        self.assertEqual(res.status_code, 400)


class ProfileTests(APITestCase):
    def setUp(self):
        super().setUp()
        self.user = make_user()
        self.client.force_authenticate(self.user)

    def test_update_profile_cannot_change_role_or_email(self):
        res = self.client.patch("/api/v1/users/me/", {"name": "New Name", "bio": "Hi", "role": "ADMIN", "email": "a@b.c"})
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.name, "New Name")
        self.assertEqual(self.user.role, User.Role.STUDENT)
        self.assertEqual(self.user.email, "student@example.com")

    def test_update_headline(self):
        res = self.client.patch("/api/v1/users/me/", {"headline": "Instructor of FNPH"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["headline"], "Instructor of FNPH")

    def test_change_password_requires_current_password(self):
        url = "/api/v1/users/me/password/"
        bad = self.client.post(url, {"current_password": "wrong", "new_password": "An0ther-Str0ng-one"})
        self.assertEqual(bad.status_code, 400)
        ok = self.client.post(url, {"current_password": PASSWORD, "new_password": "An0ther-Str0ng-one"})
        self.assertEqual(ok.status_code, 204)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("An0ther-Str0ng-one"))


class PasswordResetTests(APITestCase):
    def setUp(self):
        super().setUp()
        self.user = make_user(email="reset@example.com")

    def test_unknown_email_gets_same_response_and_no_mail(self):
        res = self.client.post("/api/v1/auth/password-reset/", {"email": "nobody@example.com"})
        self.assertEqual(res.status_code, 204)
        self.assertEqual(len(mail.outbox), 0)

    def request_code(self) -> str:
        res = self.client.post("/api/v1/auth/password-reset/", {"email": "reset@example.com"})
        self.assertEqual(res.status_code, 204)
        return re.search(r"code is: (\d{6})", mail.outbox[-1].body).group(1)

    def confirm(self, code, password="Brand-New-Pass-42", email="reset@example.com"):
        return self.client.post(
            "/api/v1/auth/password-reset/confirm/", {"email": email, "code": code, "new_password": password}
        )

    def test_full_reset_flow_signs_out_other_sessions(self):
        old_refresh = self.client.post("/api/v1/auth/login/", {"email": "reset@example.com", "password": PASSWORD}).data["refresh"]
        code = self.request_code()
        self.assertIn(code, mail.outbox[0].subject)
        wrong = "000000" if code != "000000" else "111111"

        bad = self.confirm(wrong)
        self.assertEqual(bad.status_code, 400)
        self.assertIn("4 attempts left", str(bad.data["code"]))

        self.assertEqual(self.confirm(code).status_code, 204)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Brand-New-Pass-42"))

        self.assertEqual(self.confirm(code, "Third-Pass-Value-7").status_code, 400)  # single use
        self.assertEqual(self.client.post("/api/v1/auth/refresh/", {"refresh": old_refresh}).status_code, 401)

    def test_reset_emails_are_friendly_html(self):
        code = self.request_code()
        email = mail.outbox[-1]
        html = email.alternatives[0][0]
        self.assertIn(code, html)
        self.assertIn("Didn't ask for this?", html)
        self.assertIn("Warm regards", email.body)

        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.confirm(code).status_code, 204)
        changed = mail.outbox[-1]
        self.assertEqual(changed.subject, "Your Lop-rig password has been changed")
        self.assertEqual(changed.to, ["reset@example.com"])
        self.assertIn("Wasn't you?", changed.alternatives[0][0])

    def test_code_is_stored_hashed(self):
        code = self.request_code()
        stored = PasswordResetCode.objects.get(user=self.user)
        self.assertNotEqual(stored.code_hash, code)
        self.assertNotIn(code, stored.code_hash)

    def test_five_wrong_attempts_lock_the_code(self):
        code = self.request_code()
        wrong = "000000" if code != "000000" else "111111"
        for _ in range(5):
            self.assertEqual(self.confirm(wrong).status_code, 400)
        locked = self.confirm(code)
        self.assertEqual(locked.status_code, 400)
        self.assertIn("Too many wrong attempts", str(locked.data["code"]))
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(PASSWORD))

    def test_expired_code_is_rejected(self):
        code = self.request_code()
        PasswordResetCode.objects.filter(user=self.user).update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.confirm(code).status_code, 400)

    def test_new_code_cancels_the_old_one(self):
        first = self.request_code()
        second = self.request_code()
        if first != second:
            self.assertEqual(self.confirm(first).status_code, 400)
        self.assertEqual(self.confirm(second).status_code, 204)

    def test_code_for_other_email_and_bad_format(self):
        code = self.request_code()
        make_user(email="someone@example.com")
        self.assertEqual(self.confirm(code, email="someone@example.com").status_code, 400)
        self.assertEqual(self.confirm("12ab").status_code, 400)
        weak = self.confirm(code, password="123")
        self.assertEqual(weak.status_code, 400)
        self.assertIn("new_password", weak.data)
