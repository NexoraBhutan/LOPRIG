from django.core.cache import cache
from rest_framework.test import APITestCase

from apps.enrollments.models import Enrollment
from apps.learning.models import LessonComment

from .factories import lessons_of, make_admin, make_course, make_teacher, make_user


class LessonDiscussionTests(APITestCase):
    def setUp(self):
        cache.clear()  # posting is rate limited
        self.teacher = make_teacher()
        self.course = make_course("paid-course", price="500", teacher=self.teacher)
        self.preview, self.lesson = lessons_of(self.course)[:2]
        self.student = make_user()
        Enrollment.objects.create(student=self.student, course=self.course, status=Enrollment.Status.ACTIVE)
        self.outsider = make_user(email="outsider@example.com", name="Not Enrolled")

    def url(self, lesson=None):
        return f"/api/v1/learning/lessons/{(lesson or self.lesson).id}/comments/"

    def post(self, body, user=None, lesson=None, **extra):
        self.client.force_authenticate(user or self.student)
        return self.client.post(self.url(lesson), {"body": body, **extra}, format="json")

    def test_enrolled_student_comments_and_teacher_replies_as_instructor(self):
        res = self.post("  How do loops work?  ")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["body"], "How do loops work?")
        self.assertFalse(res.data["is_instructor"])

        reply = self.post("Great question!", user=self.teacher, parent=res.data["id"])
        self.assertEqual(reply.status_code, 201, reply.data)

        listing = self.client.get(self.url()).data
        self.assertEqual(listing["count"], 2)
        thread = listing["results"][0]
        self.assertEqual(thread["author"]["name"], "Test Student")
        self.assertNotIn("email", thread["author"])  # never expose other people's emails
        self.assertEqual(thread["replies"][0]["body"], "Great question!")
        self.assertTrue(thread["replies"][0]["is_instructor"])

    def test_replies_stay_one_level_deep(self):
        top = self.post("Question").data
        reply = self.post("Reply", user=self.teacher, parent=top["id"]).data
        nested = self.post("Reply to reply", parent=reply["id"]).data
        self.assertEqual(nested["parent"], top["id"])

    def test_outsiders_and_visitors_cannot_read_or_post_on_paid_lessons(self):
        self.assertEqual(self.post("Hi", user=self.outsider).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url()).status_code, 401)
        self.assertEqual(self.client.post(self.url(), {"body": "Hi"}).status_code, 401)

    def test_preview_lessons_are_readable_but_only_students_in_the_course_comment(self):
        self.post("Nice intro", lesson=self.preview)
        self.client.force_authenticate(self.outsider)
        self.assertEqual(self.client.get(self.url(self.preview)).status_code, 200)
        res = self.post("Me too", user=self.outsider, lesson=self.preview)
        self.assertEqual(res.status_code, 403)
        self.assertIn("Enroll", str(res.data))

    def test_empty_and_too_long_comments_are_rejected(self):
        self.assertEqual(self.post("   ").status_code, 400)
        self.assertEqual(self.post("x" * (LessonComment.BODY_MAX + 1)).status_code, 400)

    def test_delete_own_and_moderation(self):
        mine = self.post("Mine").data
        other = make_user(email="other@example.com", name="Other")
        Enrollment.objects.create(student=other, course=self.course, status=Enrollment.Status.ACTIVE)
        theirs = self.post("Theirs", user=other).data

        self.client.force_authenticate(self.student)
        listing = self.client.get(self.url()).data["results"]
        self.assertFalse(next(c for c in listing if c["id"] == theirs["id"])["can_delete"])
        self.assertEqual(self.client.delete(f"/api/v1/learning/comments/{theirs['id']}/").status_code, 403)
        self.assertEqual(self.client.delete(f"/api/v1/learning/comments/{mine['id']}/").status_code, 204)

        self.client.force_authenticate(self.teacher)  # the course's teacher can remove anything here
        self.assertEqual(self.client.delete(f"/api/v1/learning/comments/{theirs['id']}/").status_code, 204)
        self.assertEqual(LessonComment.objects.count(), 0)

    def test_admin_can_read_and_moderate(self):
        top = self.post("Question").data
        self.client.force_authenticate(make_admin())
        self.assertEqual(self.client.get(self.url()).status_code, 200)
        self.assertEqual(self.client.delete(f"/api/v1/learning/comments/{top['id']}/").status_code, 204)


class LessonViewsTests(APITestCase):
    def setUp(self):
        self.teacher = make_teacher()
        self.course = make_course("viewed-course", price="500", teacher=self.teacher)
        self.lesson = lessons_of(self.course)[1]

    def view(self, user):
        self.client.force_authenticate(user)
        return self.client.post(f"/api/v1/learning/lessons/{self.lesson.id}/view/")

    def test_counts_unique_students_only(self):
        a, b = make_user(email="a@example.com"), make_user(email="b@example.com")
        for s in (a, b):
            Enrollment.objects.create(student=s, course=self.course, status=Enrollment.Status.ACTIVE)
        self.assertEqual(self.view(a).data["views"], 1)
        self.assertEqual(self.view(a).data["views"], 1)  # refreshing doesn't add views
        self.assertEqual(self.view(b).data["views"], 2)
        self.assertEqual(self.view(self.teacher).data["views"], 2)  # the teacher checking doesn't count

        self.client.force_authenticate(a)
        player = self.client.get(f"/api/v1/learning/courses/{self.course.slug}/").data
        lesson = next(l for m in player["modules"] for l in m["lessons"] if l["id"] == self.lesson.id)
        self.assertEqual(lesson["views"], 2)

    def test_students_without_access_are_refused(self):
        self.assertEqual(self.view(make_user(email="nope@example.com")).status_code, 403)
