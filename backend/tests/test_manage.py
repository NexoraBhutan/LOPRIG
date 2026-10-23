from rest_framework.test import APITestCase

from apps.courses.models import Course
from apps.notifications.models import Notification
from apps.users.models import User

from .factories import PASSWORD, lessons_of, make_course, make_teacher, make_user

BASE = "/api/v1/manage"


class AdminPortalTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(email="boss@example.com", password="Adm1n-pass-123", name="Boss")
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
        res = self.client.post(f"{BASE}/users/", {
            "name": "Pema Lhamo", "email": "Pema@Teachers.bt", "role": "TEACHER", "password": "Teach-2026-strong",
        })
        self.assertEqual(res.status_code, 201, res.data)
        created = User.objects.get(email="pema@teachers.bt")
        self.assertTrue(created.check_password("Teach-2026-strong"))
        self.assertFalse(created.is_staff)
        dup = self.client.post(f"{BASE}/users/", {"name": "X", "email": "pema@teachers.bt", "password": "Teach-2026-strong"})
        self.assertEqual(dup.status_code, 400)

        teachers = self.client.get(f"{BASE}/users/?role=TEACHER").data["results"]
        self.assertEqual({u["email"] for u in teachers}, {"teacher@example.com", "pema@teachers.bt"})
        student_row = self.client.get(f"{BASE}/users/?search=karma").data["results"][0]
        self.assertEqual(student_row["enrollments"], 1)

        promoted = self.client.patch(f"{BASE}/users/{created.id}/", {"role": "ADMIN"})
        self.assertEqual(promoted.data["role"], "ADMIN")
        created.refresh_from_db()
        self.assertTrue(created.is_staff and created.is_superuser)

        self.client.patch(f"{BASE}/users/{self.student.id}/", {"is_active": False})
        self.student.refresh_from_db()
        self.assertFalse(self.student.is_active)
        login = self.client.post("/api/v1/auth/login/", {"email": "student@example.com", "password": PASSWORD})
        self.assertEqual(login.status_code, 401)

    def test_admin_cannot_lock_themselves_out(self):
        self.assertEqual(self.client.patch(f"{BASE}/users/{self.admin.id}/", {"role": "STUDENT"}).status_code, 400)
        self.assertEqual(self.client.patch(f"{BASE}/users/{self.admin.id}/", {"is_active": False}).status_code, 400)

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
