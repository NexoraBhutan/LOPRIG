from rest_framework.test import APITestCase

from apps.courses import services as course_services
from apps.courses.models import Course, Lesson
from apps.notifications.models import Notification
from apps.users.models import User

from .factories import lessons_of, make_admin, make_category, make_course, make_teacher, make_user

NEW_COURSE = {
    "title": "Intro to Dzongkha Typing",
    "description": "Learn to type Dzongkha quickly and accurately on any keyboard layout.",
    "category": "programming",
    "level": "Beginner",
    "language": "English",
    "price": 400,
    "discount_price": 300,
    "what_you_learn": ["Type Dzongkha letters", "Use common shortcuts"],
    "requirements": ["A computer"],
}


class TeacherAccessTests(APITestCase):
    def setUp(self):
        make_category()
        self.teacher = make_teacher()
        self.other = make_teacher(email="other-teacher@example.com")
        self.theirs = make_course("their-course", teacher=self.other)

    def test_only_teachers_can_use_the_portal(self):
        self.assertEqual(self.client.get("/api/v1/teach/summary/").status_code, 401)
        self.client.force_authenticate(make_user())
        self.assertEqual(self.client.get("/api/v1/teach/summary/").status_code, 403)
        self.assertEqual(self.client.post("/api/v1/teach/courses/", NEW_COURSE).status_code, 403)

    def test_teachers_cannot_see_or_change_other_teachers_courses(self):
        self.client.force_authenticate(self.teacher)
        self.assertEqual(self.client.get("/api/v1/teach/courses/").data, [])
        self.assertEqual(self.client.get("/api/v1/teach/courses/their-course/").status_code, 404)
        self.assertEqual(self.client.patch("/api/v1/teach/courses/their-course/", {"title": "Hacked title"}).status_code, 404)
        self.assertEqual(self.client.get("/api/v1/teach/courses/their-course/students/").status_code, 404)
        module_id = self.theirs.modules.first().id
        lesson_id = lessons_of(self.theirs)[0].id
        self.assertEqual(self.client.patch(f"/api/v1/teach/modules/{module_id}/", {"title": "x"}).status_code, 404)
        self.assertEqual(self.client.post(f"/api/v1/teach/modules/{module_id}/lessons/", {"title": "x"}).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/v1/teach/lessons/{lesson_id}/").status_code, 404)
        self.theirs.refresh_from_db()
        self.assertNotEqual(self.theirs.title, "Hacked title")


class CourseAuthoringTests(APITestCase):
    def setUp(self):
        make_category()
        self.teacher = make_teacher()
        self.admin = make_admin(email="admin@example.com")
        self.client.force_authenticate(self.teacher)

    def create_course(self):
        res = self.client.post("/api/v1/teach/courses/", NEW_COURSE, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        return res.data

    def test_create_course_starts_as_unique_draft(self):
        first = self.create_course()
        second = self.create_course()
        self.assertEqual(first["status"], "DRAFT")
        self.assertEqual(first["id"], "intro-to-dzongkha-typing")
        self.assertEqual(second["id"], "intro-to-dzongkha-typing-2")
        self.assertEqual(Course.objects.get(slug=first["id"]).teacher, self.teacher)
        # Drafts are invisible in the public catalogue.
        self.assertEqual(self.client.get(f"/api/v1/courses/{first['id']}/").status_code, 404)

    def test_sale_price_cannot_exceed_price(self):
        res = self.client.post("/api/v1/teach/courses/", {**NEW_COURSE, "discount_price": 999}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("discount_price", res.data)

    def test_build_curriculum_submit_and_get_approved(self):
        slug = self.create_course()["id"]
        # Submitting an empty course explains what is missing.
        empty = self.client.post(f"/api/v1/teach/courses/{slug}/submit/")
        self.assertEqual(empty.status_code, 400)
        self.assertIn("Add at least one lesson.", str(empty.data))

        module = self.client.post(f"/api/v1/teach/courses/{slug}/modules/", {"title": "Getting started"}).data
        lesson = self.client.post(
            f"/api/v1/teach/modules/{module['id']}/lessons/",
            {"title": "The keyboard", "kind": "VIDEO", "duration_seconds": 420,
             "video_url": "https://videos.example.com/keyboard.mp4", "is_preview": True},
            format="json",
        )
        self.assertEqual(lesson.status_code, 201, lesson.data)
        second = self.client.post(f"/api/v1/teach/modules/{module['id']}/lessons/", {"title": "Vowels"}).data
        self.assertEqual(second["order"], 1)
        res = self.client.post(f"/api/v1/teach/lessons/{lesson.data['id']}/resources/",
                               {"title": "Cheat sheet", "url": "https://example.com/sheet.pdf"})
        self.assertEqual(res.status_code, 201)

        detail = self.client.get(f"/api/v1/teach/courses/{slug}/").data
        self.assertEqual(detail["lessons_count"], 2)
        self.assertEqual(detail["modules"][0]["lessons"][0]["resources"][0]["title"], "Cheat sheet")
        self.assertEqual(detail["review_problems"], [])

        submitted = self.client.post(f"/api/v1/teach/courses/{slug}/submit/")
        self.assertEqual(submitted.data["status"], "PENDING_REVIEW")
        self.assertTrue(Notification.objects.filter(user=self.admin, title="Course submitted for review").exists())
        self.assertEqual(self.client.post(f"/api/v1/teach/courses/{slug}/submit/").status_code, 400)

        course_services.approve(Course.objects.get(slug=slug))
        self.assertEqual(self.client.get(f"/api/v1/courses/{slug}/").status_code, 200)
        self.assertTrue(Notification.objects.filter(user=self.teacher, title__contains="is published").exists())

    def test_reject_sends_note_and_allows_resubmit(self):
        course = make_course("needs-work", teacher=self.teacher, status=Course.Status.PENDING_REVIEW)
        course.what_you_learn = ["Something"]
        course.description = "A long enough description for the review checks."
        course.save()
        course_services.reject(course, "Please add captions to the videos.")
        detail = self.client.get("/api/v1/teach/courses/needs-work/").data
        self.assertEqual(detail["status"], "REJECTED")
        self.assertEqual(detail["review_note"], "Please add captions to the videos.")
        self.assertEqual(self.client.post("/api/v1/teach/courses/needs-work/submit/").data["status"], "PENDING_REVIEW")

    def test_edit_and_reorder_lessons(self):
        course = make_course("my-course", teacher=self.teacher, status=Course.Status.DRAFT)
        first, second, _ = lessons_of(course)
        self.client.patch(f"/api/v1/teach/lessons/{first.id}/", {"order": 1})
        self.client.patch(f"/api/v1/teach/lessons/{second.id}/", {"order": 0, "title": "Renamed"})
        titles = [l.title for l in Lesson.objects.filter(module__course=course).order_by("order")]
        self.assertEqual(titles[:2], ["Renamed", "Lesson 1"])
        self.assertEqual(self.client.delete(f"/api/v1/teach/lessons/{first.id}/").status_code, 204)

    def test_cannot_delete_published_course_with_students(self):
        course = make_course("live-course", teacher=self.teacher, price="0")
        self.client.force_authenticate(make_user(email="s@example.com"))
        self.client.post("/api/v1/courses/live-course/enroll/")
        self.client.force_authenticate(self.teacher)
        self.assertEqual(self.client.delete("/api/v1/teach/courses/live-course/").status_code, 409)
        draft = self.create_course()["id"]
        self.assertEqual(self.client.delete(f"/api/v1/teach/courses/{draft}/").status_code, 204)
        self.assertTrue(Course.objects.filter(pk=course.pk).exists())


class StudentsAndSummaryTests(APITestCase):
    def test_teacher_sees_their_students_progress_and_summary(self):
        teacher = make_teacher()
        course = make_course("python-101", teacher=teacher, price="0", lessons=4)
        student = make_user(name="Karma Dema")
        self.client.force_authenticate(student)
        self.client.post("/api/v1/courses/python-101/enroll/")
        self.client.post(f"/api/v1/learning/lessons/{lessons_of(course)[0].id}/progress/", {"completed": True})

        self.client.force_authenticate(teacher)
        students = self.client.get("/api/v1/teach/courses/python-101/students/").data["results"]
        self.assertEqual(students[0]["name"], "Karma Dema")
        self.assertEqual(students[0]["progress"], 25)
        self.assertEqual(students[0]["completed_lessons"], 1)

        summary = self.client.get("/api/v1/teach/summary/").data
        self.assertEqual(summary["students"], 1)
        self.assertEqual(summary["courses"]["PUBLISHED"], 1)
        self.assertEqual(summary["recent_enrollments"][0]["student"], "Karma Dema")

        listed = self.client.get("/api/v1/teach/courses/").data[0]
        self.assertEqual(listed["enrolled"], 1)
        self.assertEqual(listed["lessons_count"], 4)


class AdminDashboardTests(APITestCase):
    def test_admin_dashboard_and_review_buttons(self):
        admin = User.objects.create_superuser(email="boss@example.com", password="Adm1n-pass-123", name="Boss")
        course = make_course("waiting", status=Course.Status.PENDING_REVIEW)
        self.client.force_login(admin)
        home = self.client.get("/admin/")
        self.assertEqual(home.status_code, 200)
        self.assertContains(home, "Courses awaiting review")
        self.assertContains(home, course.title)

        reject = self.client.post(f"/admin/courses/course/{course.pk}/reject/")
        self.assertEqual(reject.status_code, 302)
        course.refresh_from_db()
        self.assertEqual(course.status, Course.Status.PENDING_REVIEW)  # refused: no review note yet

        approve = self.client.post(f"/admin/courses/course/{course.pk}/approve/")
        self.assertEqual(approve.status_code, 302)
        course.refresh_from_db()
        self.assertEqual(course.status, Course.Status.PUBLISHED)
        for page in ["/admin/courses/course/", "/admin/users/user/", "/admin/payments/payment/",
                     f"/admin/courses/course/{course.pk}/change/"]:
            self.assertEqual(self.client.get(page).status_code, 200, page)
