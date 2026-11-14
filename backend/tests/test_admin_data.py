from rest_framework.test import APITestCase

from apps.courses.models import Category
from apps.platform_admin.data import TABLES
from apps.users.models import User

from .factories import make_admin, make_course, make_teacher, make_user

BASE = "/api/v1/manage/data"


class AdminDataManagerTests(APITestCase):
    """The admin portal's data manager: every Django Admin table, for website admins only."""

    def setUp(self):
        self.admin = make_admin()
        self.teacher = make_teacher()
        self.course = make_course("python-101", teacher=self.teacher)
        self.client.force_authenticate(self.admin)

    def test_every_table_lists_and_opens(self):
        groups = self.client.get(f"{BASE}/").data["groups"]
        slugs = [t["slug"] for g in groups for t in g["tables"]]
        self.assertEqual(sorted(slugs), sorted(TABLES))
        for slug in TABLES:
            res = self.client.get(f"{BASE}/{slug}/")
            self.assertEqual(res.status_code, 200, slug)
            self.assertEqual(res.data["table"]["slug"], slug)
            if res.data["results"]:
                row = res.data["results"][0]
                self.assertEqual(self.client.get(f"{BASE}/{slug}/{row['id']}/").status_code, 200, slug)

    def test_search_filter_and_relation_labels(self):
        res = self.client.get(f"{BASE}/courses/", {"q": "python"}).data
        self.assertEqual(res["count"], 1)
        self.assertEqual(res["results"][0]["values"]["teacher"]["label"], f"{self.teacher.name} ({self.teacher.email})")
        self.assertEqual(self.client.get(f"{BASE}/courses/", {"f_status": "DRAFT"}).data["count"], 0)
        options = self.client.get(f"{BASE}/users/options/", {"q": "teacher@"}).data
        self.assertEqual(options[0]["id"], self.teacher.id)

    def test_add_edit_and_delete_a_category(self):
        res = self.client.post(f"{BASE}/categories/", {"title": "Music", "slug": "music", "icon": "Code", "order": 9},
                               format="json")
        self.assertEqual(res.status_code, 201, res.data)
        pk = res.data["id"]
        res = self.client.patch(f"{BASE}/categories/{pk}/", {"title": "Music & Arts"}, format="json")
        self.assertEqual(res.data["values"]["title"], "Music & Arts")
        self.assertEqual(self.client.delete(f"{BASE}/categories/{pk}/").status_code, 204)
        self.assertFalse(Category.objects.filter(pk=pk).exists())

    def test_validation_errors_come_back_per_field(self):
        res = self.client.post(f"{BASE}/categories/", {"title": "", "slug": "has spaces"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("slug", res.data)

    def test_edit_a_relation_and_readonly_fields_are_ignored(self):
        other = make_teacher(email="other@example.com")
        res = self.client.patch(f"{BASE}/courses/{self.course.pk}/",
                                {"teacher": other.pk, "status": "DRAFT"}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.course.refresh_from_db()
        self.assertEqual(self.course.teacher, other)
        self.assertEqual(self.course.status, "PUBLISHED")  # status changes go through Course review

    def test_protected_records_explain_why(self):
        res = self.client.delete(f"{BASE}/categories/{self.course.category_id}/")
        self.assertEqual(res.status_code, 409)
        self.assertIn("other records still use it", res.data["detail"])

    def test_safety_rules(self):
        self.assertEqual(self.client.delete(f"{BASE}/users/{self.admin.pk}/").status_code, 400)
        self.assertEqual(self.client.patch(f"{BASE}/users/{self.admin.pk}/", {"role": "STUDENT"},
                                           format="json").status_code, 400)
        self.assertEqual(self.client.post(f"{BASE}/users/", {"email": "x@y.z"}, format="json").status_code, 403)
        self.assertEqual(self.client.delete(f"{BASE}/payments/1/").status_code, 403)
        self.assertNotIn("password", [f["name"] for f in self.client.get(f"{BASE}/users/").data["table"]["fields"]])

    def test_bulk_delete_reports_failures(self):
        student = make_user()
        res = self.client.post(f"{BASE}/users/bulk-delete/", {"ids": [student.pk, self.admin.pk]}, format="json")
        self.assertEqual(res.data["deleted"], 1)
        self.assertEqual(res.data["failed"][0]["id"], self.admin.pk)
        self.assertFalse(User.objects.filter(pk=student.pk).exists())

    def test_only_admins(self):
        for user in (self.teacher, make_user(email="kid@example.com")):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(f"{BASE}/").status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"{BASE}/courses/").status_code, 401)


class AdminQuizAndPaymentRulesTests(APITestCase):
    def setUp(self):
        self.admin = make_admin()
        self.client.force_authenticate(self.admin)

    def test_admins_cannot_add_quizzes_or_questions(self):
        for slug in ("quizzes", "questions"):
            self.assertFalse(self.client.get(f"{BASE}/{slug}/").data["table"]["can_add"])
            self.assertEqual(self.client.post(f"{BASE}/{slug}/", {"title": "X"}, format="json").status_code, 403)

    def test_admins_cannot_add_quizzes_in_django_admin(self):
        from django.test import Client
        browser = Client()
        browser.force_login(self.admin)
        self.assertEqual(browser.get("/admin/courses/quiz/").status_code, 200)  # can still check them
        self.assertEqual(browser.get("/admin/courses/quiz/add/").status_code, 403)

    def test_payment_links_open_that_payment(self):
        from apps.notifications.links import link_for
        from apps.notifications.models import Notification
        n = Notification(user=self.admin, kind="PAYMENT", data={"payment": "pay_abc123"})
        self.assertEqual(link_for(n), "/admin/payments?review=pay_abc123")
        self.assertIn("payments_to_verify", self.client.get("/api/v1/manage/summary/").data["totals"])


class AdminLessonOverviewTests(APITestCase):
    """The portal's Lessons page: same teacher cards and review cards as Django Admin's."""

    def setUp(self):
        self.admin = make_admin()
        self.teacher = make_teacher()
        self.live = make_course("python-101", teacher=self.teacher, lessons=2)
        self.waiting = make_course("go-101", teacher=self.teacher, lessons=1, status="PENDING_REVIEW")
        self.client.force_authenticate(self.admin)

    def test_teachers_and_courses_awaiting_review(self):
        data = self.client.get("/api/v1/manage/lessons/overview/").data
        card = data["teachers"][0]
        self.assertEqual((card["lesson_count"], card["course_count"], card["published_count"]), (3, 2, 1))
        self.assertEqual(data["pending_total"], 1)
        self.assertEqual([c["id"] for c in data["courses"]], ["go-101"])
        self.assertEqual(data["courses"][0]["modules"][0]["lessons"][0]["kind"], "Video")

    def test_picking_a_teacher_shows_all_their_courses_and_lessons(self):
        data = self.client.get("/api/v1/manage/lessons/overview/", {"teacher": self.teacher.pk}).data
        self.assertEqual(data["selected"], self.teacher.pk)
        self.assertEqual({c["id"] for c in data["courses"]}, {"python-101", "go-101"})
        rows = self.client.get(f"{BASE}/lessons/", {"f_module__course__teacher": self.teacher.pk}).data
        self.assertEqual(rows["count"], 3)

    def test_only_admins(self):
        self.client.force_authenticate(self.teacher)
        self.assertEqual(self.client.get("/api/v1/manage/lessons/overview/").status_code, 403)
