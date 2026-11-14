import re

from django.core import mail
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.courses.models import Course
from apps.notifications.models import Notification
from apps.users.models import User

from .factories import PASSWORD, lessons_of, make_admin, make_course, make_teacher, make_user

BASE = "/api/v1/manage"


def emailed_password(index=-1):
    return re.search(r"Temporary password: (\S+)", mail.outbox[index].body).group(1)


class AdminPortalTests(APITestCase):
    def setUp(self):
        self.admin = make_admin()
        self.teacher = make_teacher()
        self.student = make_user(name="Karma Dema")
        self.course = make_course("python-101", teacher=self.teacher, price="0", lessons=2)
        self.client.force_authenticate(self.student)
        self.client.post("/api/v1/courses/python-101/enroll/")
        self.client.post(f"/api/v1/learning/lessons/{lessons_of(self.course)[0].id}/progress/", {"completed": True})
        self.client.force_authenticate(self.admin)

    def test_only_admins_get_in(self):
        for user in (self.student, self.teacher):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(f"{BASE}/summary/").status_code, 403)
            self.assertEqual(self.client.get(f"{BASE}/users/").status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"{BASE}/summary/").status_code, 401)

    def test_summary_numbers(self):
        data = self.client.get(f"{BASE}/summary/").data
        totals = data["totals"]
        self.assertEqual(totals["students"], 1)
        self.assertEqual(totals["teachers"], 1)
        self.assertEqual(totals["enrollments"], 1)
        self.assertEqual(totals["courses"]["PUBLISHED"], 1)
        self.assertEqual(len(data["series"]), 30)
        self.assertEqual(sum(d["enrollments"] for d in data["series"]), 1)
        self.assertEqual(data["top_courses"][0]["id"], "python-101")

    def test_review_approve_and_reject(self):
        pending = make_course("waiting", teacher=self.teacher, status=Course.Status.PENDING_REVIEW)
        listed = self.client.get(f"{BASE}/courses/?status=PENDING_REVIEW").data["results"]
        self.assertEqual([c["id"] for c in listed], ["waiting"])
        detail = self.client.get(f"{BASE}/courses/waiting/").data
        self.assertEqual(len(detail["modules"][0]["lessons"]), 3)

        short = self.client.post(f"{BASE}/courses/waiting/reject/", {"note": "no"})
        self.assertEqual(short.status_code, 400)
        rejected = self.client.post(f"{BASE}/courses/waiting/reject/", {"note": "Please add captions to the videos."})
        self.assertEqual(rejected.data["status"], "REJECTED")
        self.assertTrue(Notification.objects.filter(user=self.teacher, title__contains="needs changes").exists())

        approved = self.client.post(f"{BASE}/courses/waiting/approve/")
        self.assertEqual(approved.data["status"], "PUBLISHED")
        pending.refresh_from_db()
        self.assertIsNotNone(pending.published_at)

    def test_create_teacher_and_manage_users(self):
        res = self.client.post(f"{BASE}/users/", {"name": "Pema Lhamo", "email": "Pema@Teachers.bt", "role": "TEACHER"})
        self.assertEqual(res.status_code, 201, res.data)
        created = User.objects.get(email="pema@teachers.bt")
        self.assertTrue(created.check_password(emailed_password()))
        self.assertFalse(created.is_staff)
        dup = self.client.post(f"{BASE}/users/", {"name": "X", "email": "pema@teachers.bt"})
        self.assertEqual(dup.status_code, 400)

        teachers = self.client.get(f"{BASE}/users/?role=TEACHER").data["results"]
        self.assertEqual({u["email"] for u in teachers}, {"teacher@example.com", "pema@teachers.bt"})
        student_row = self.client.get(f"{BASE}/users/?search=karma").data["results"][0]
        self.assertEqual(student_row["enrollments"], 1)

        promoted = self.client.patch(f"{BASE}/users/{created.id}/", {"role": "ADMIN"})
        self.assertEqual(promoted.data["role"], "ADMIN")
        created.refresh_from_db()
        self.assertFalse(created.is_staff or created.is_superuser)  # website admin, no Django Admin

        # The portal can never hand out site administration.
        self.assertEqual(self.client.patch(f"{BASE}/users/{created.id}/", {"role": "SITEADMIN"}).status_code, 400)
        self.assertEqual(self.client.post(f"{BASE}/users/", {"name": "S", "email": "s@x.bt", "role": "SITEADMIN"}).status_code, 400)

        self.client.patch(f"{BASE}/users/{self.student.id}/", {"is_active": False})
        self.student.refresh_from_db()
        self.assertFalse(self.student.is_active)
        login = self.client.post("/api/v1/auth/login/", {"email": "student@example.com", "password": PASSWORD})
        self.assertEqual(login.status_code, 401)

    def test_generated_password_flow(self):
        """Admin creates a teacher, the password is emailed (never shown to the admin), the teacher
        logs in, is blocked from the portal until they set their own password."""
        res = self.client.post(f"{BASE}/users/", {"name": "Sonam Choden", "email": "sonam@teachers.bt", "role": "TEACHER"})
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data["email_sent"])
        self.assertTrue(res.data["must_change_password"])
        self.assertNotIn("temporary_password", res.data)
        self.assertNotIn("password", res.data)
        self.assertEqual(mail.outbox[-1].to, ["sonam@teachers.bt"])
        temp = emailed_password()
        self.assertEqual(len(temp), 19)
        self.assertIn("/login", mail.outbox[-1].body)

        self.client.force_authenticate(None)
        login = self.client.post("/api/v1/auth/login/", {"email": "sonam@teachers.bt", "password": temp})
        self.assertEqual(login.status_code, 200, login.data)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        self.assertTrue(self.client.get("/api/v1/users/me/").data["must_change_password"])
        blocked = self.client.get("/api/v1/teach/summary/")
        self.assertEqual(blocked.status_code, 403)
        self.assertIn("own password", str(blocked.data))

        weak = self.client.post("/api/v1/users/me/password/", {"current_password": temp, "new_password": "password"})
        self.assertEqual(weak.status_code, 400)
        done = self.client.post("/api/v1/users/me/password/", {"current_password": temp, "new_password": "My-own-Pass-77"})
        self.assertEqual(done.status_code, 204)
        self.assertFalse(self.client.get("/api/v1/users/me/").data["must_change_password"])
        self.assertEqual(self.client.get("/api/v1/teach/summary/").status_code, 200)

        self.client.credentials()
        self.client.force_authenticate(self.admin)
        row = self.client.get(f"{BASE}/users/?search=sonam").data["results"][0]
        self.assertFalse(row["must_change_password"])

    def test_admin_reset_password(self):
        login = self.client.post("/api/v1/auth/login/", {"email": "teacher@example.com", "password": PASSWORD})
        refresh = login.data["refresh"]

        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.post(f"{BASE}/users/{self.teacher.id}/reset-password/").status_code, 403)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(f"{BASE}/users/{self.admin.id}/reset-password/").status_code, 400)

        res = self.client.post(f"{BASE}/users/{self.teacher.id}/reset-password/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data["must_change_password"] and res.data["email_sent"])
        self.assertNotIn("temporary_password", res.data)
        self.assertEqual(mail.outbox[-1].to, ["teacher@example.com"])
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post("/api/v1/auth/refresh/", {"refresh": refresh}).status_code, 401)
        old = self.client.post("/api/v1/auth/login/", {"email": "teacher@example.com", "password": PASSWORD})
        self.assertEqual(old.status_code, 401)
        new = self.client.post("/api/v1/auth/login/", {"email": "teacher@example.com", "password": emailed_password()})
        self.assertEqual(new.status_code, 200)

    def test_admin_cannot_lock_themselves_out(self):
        self.assertEqual(self.client.patch(f"{BASE}/users/{self.admin.id}/", {"role": "STUDENT"}).status_code, 400)
        self.assertEqual(self.client.patch(f"{BASE}/users/{self.admin.id}/", {"is_active": False}).status_code, 400)

    @override_settings(PAYMENTS_ENABLED=True, PAYMENT_PROVIDER="mock")
    def test_enrollments_and_payments_lists(self):
        rows = self.client.get(f"{BASE}/enrollments/").data["results"]
        self.assertEqual(rows[0]["student"], "Karma Dema")
        self.assertEqual(rows[0]["progress"], 50)
        self.assertEqual(self.client.get(f"{BASE}/enrollments/?search=nobody").data["count"], 0)

        make_course("paid", teacher=self.teacher, price="300")
        self.client.force_authenticate(self.student)
        ref = self.client.post("/api/v1/payments/checkout/", {"course": "paid"}).data["payment"]["reference"]
        self.client.post(f"/api/v1/payments/mock/{ref}/pay/", {"outcome": "success"})
        self.client.force_authenticate(self.admin)
        payments = self.client.get(f"{BASE}/payments/?status=SUCCEEDED").data["results"]
        self.assertEqual(payments[0]["reference"], ref)
        self.assertEqual(payments[0]["amount"], 300)
        self.assertEqual(self.client.get(f"{BASE}/summary/").data["totals"]["revenue"], 300)


class SeparateAdminAccountsTests(APITestCase):
    """Site administrators are Django-Admin-only accounts; website admins can use both."""

    def setUp(self):
        from django.core.cache import cache

        cache.clear()  # login is rate limited
        self.admin = make_admin()
        self.site_admin = User.objects.create_superuser(email="root@example.com", password=PASSWORD, name="Root")

    def test_createsuperuser_makes_a_site_administrator(self):
        self.assertEqual(self.site_admin.role, User.Role.SITE_ADMIN)
        self.assertTrue(self.site_admin.is_staff and self.site_admin.is_superuser)
        self.assertFalse(self.admin.is_staff or self.admin.is_superuser)

    def test_site_administrator_cannot_use_the_website(self):
        login = self.client.post("/api/v1/auth/login/", {"email": "root@example.com", "password": PASSWORD})
        self.assertEqual(login.status_code, 401)
        self.assertIn("site administration", str(login.data["detail"]))
        self.client.force_authenticate(self.site_admin)  # even with a token, the portal API refuses
        self.assertEqual(self.client.get(f"{BASE}/summary/").status_code, 403)

    def test_site_administrator_gets_no_website_reset_code(self):
        self.client.post("/api/v1/auth/password-reset/", {"email": "root@example.com"})
        self.assertEqual(len(mail.outbox), 0)

    def test_website_admin_can_also_open_django_admin(self):
        # Website admins may do everything the site administrator can, with the same login.
        self.assertTrue(self.client.login(email="boss@example.com", password=PASSWORD))
        self.assertEqual(self.client.get("/admin/").status_code, 200)
        self.client.logout()
        self.client.login(email="root@example.com", password=PASSWORD)
        self.assertEqual(self.client.get("/admin/").status_code, 200)

    def test_portal_cannot_see_or_reset_site_administrators(self):
        self.client.force_authenticate(self.admin)
        emails = {u["email"] for u in self.client.get(f"{BASE}/users/").data["results"]}
        self.assertNotIn("root@example.com", emails)
        self.assertEqual(self.client.get(f"{BASE}/users/{self.site_admin.id}/").status_code, 404)
        self.assertEqual(self.client.post(f"{BASE}/users/{self.site_admin.id}/reset-password/").status_code, 404)
