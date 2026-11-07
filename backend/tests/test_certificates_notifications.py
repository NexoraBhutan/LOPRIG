from rest_framework.test import APITestCase

from apps.notifications.models import Notification

from .factories import lessons_of, make_course, make_user


class CertificateTests(APITestCase):
    def setUp(self):
        self.student = make_user(name="Sonam Dema")
        course = make_course("short-course", price="0", lessons=1)
        self.client.force_authenticate(self.student)
        self.client.post("/api/v1/courses/short-course/enroll/")
        res = self.client.post(f"/api/v1/learning/lessons/{lessons_of(course)[0].id}/progress/", {"completed": True})
        self.code = res.data["certificate"]

    def test_my_certificates(self):
        res = self.client.get("/api/v1/certificates/")
        self.assertEqual([c["code"] for c in res.data["results"]], [self.code])
        self.assertEqual(self.client.get(f"/api/v1/certificates/{self.code}/").status_code, 200)

    def test_public_verification(self):
        self.client.force_authenticate(None)
        res = self.client.get(f"/api/v1/certificates/verify/{self.code}/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["valid"])
        self.assertEqual(res.data["student_name"], "Sonam Dema")
        self.assertNotIn("email", res.data)
        self.assertNotIn("student_email", res.data)
        self.assertTrue(res.data["instructor_name"])
        self.assertGreater(res.data["lessons_count"], 0)
        self.assertEqual(self.client.get("/api/v1/certificates/verify/LR-0000-0000/").status_code, 404)

    def test_other_students_cannot_open_my_certificate(self):
        self.client.force_authenticate(make_user(email="other@example.com"))
        self.assertEqual(self.client.get(f"/api/v1/certificates/{self.code}/").status_code, 404)


class NotificationTests(APITestCase):
    def setUp(self):
        self.student = make_user()
        self.other = make_user(email="other@example.com")
        self.mine = [Notification.objects.create(user=self.student, title=f"N{i}") for i in range(2)]
        self.theirs = Notification.objects.create(user=self.other, title="Not yours")
        self.client.force_authenticate(self.student)

    def test_list_and_mark_read(self):
        self.assertEqual(self.client.get("/api/v1/notifications/").data["count"], 2)
        self.assertEqual(self.client.get("/api/v1/notifications/unread-count/").data["unread"], 2)
        res = self.client.post(f"/api/v1/notifications/{self.mine[0].id}/read/")
        self.assertTrue(res.data["is_read"])
        self.assertEqual(self.client.get("/api/v1/notifications/?unread=true").data["count"], 1)
        self.assertEqual(self.client.post("/api/v1/notifications/read-all/").data["updated"], 1)
        self.assertEqual(self.client.get("/api/v1/notifications/unread-count/").data["unread"], 0)

    def test_cannot_touch_other_users_notifications(self):
        self.assertEqual(self.client.post(f"/api/v1/notifications/{self.theirs.id}/read/").status_code, 404)
        self.client.post("/api/v1/notifications/read-all/")
        self.theirs.refresh_from_db()
        self.assertIsNone(self.theirs.read_at)
