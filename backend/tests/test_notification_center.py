from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.enrollments.models import Enrollment
from apps.learning.models import LessonProgress
from apps.notifications.models import Notification

from .factories import lessons_of, make_admin, make_course, make_teacher, make_user


class NotificationCenterTests(APITestCase):
    """What lands in each person's bell, and where clicking it goes."""

    def setUp(self):
        cache.clear()
        self.teacher = make_teacher()
        self.course = make_course("python-101", price="0", teacher=self.teacher, lessons=2)
        self.student = make_user()

    def bell(self, user):
        self.client.force_authenticate(user)
        unread = self.client.get("/api/v1/notifications/unread-count/").data["unread"]
        items = self.client.get("/api/v1/notifications/").data["results"]
        return unread, items

    def enroll(self):
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.post("/api/v1/courses/python-101/enroll/").status_code, 201)

    def test_enrolling_tells_the_student_and_the_teacher(self):
        self.enroll()
        unread, items = self.bell(self.student)
        self.assertEqual(unread, 1)
        self.assertEqual(items[0]["kind"], "ENROLLMENT")
        self.assertEqual(items[0]["link"], "/learn/python-101")

        unread, items = self.bell(self.teacher)
        self.assertEqual(unread, 1)
        self.assertEqual(items[0]["title"], "New student in Python 101")
        self.assertEqual(items[0]["link"], "/teach/courses/python-101?tab=students")

    def test_comments_tell_the_teacher_and_replies_tell_the_author(self):
        lesson = lessons_of(self.course)[0]
        self.enroll()
        url = f"/api/v1/learning/lessons/{lesson.id}/comments/"
        question = self.client.post(url, {"body": "How do loops work?"}, format="json").data

        _, items = self.bell(self.teacher)
        comment = next(n for n in items if n["kind"] == "COMMENT")
        self.assertIn("How do loops work?", comment["message"])
        self.assertEqual(comment["link"], f"/learn/python-101?lesson={lesson.id}")

        self.client.force_authenticate(self.teacher)
        self.client.post(url, {"body": "They repeat code.", "parent": question["id"]}, format="json")
        _, items = self.bell(self.student)
        self.assertTrue(any(n["title"].endswith("replied to your comment") for n in items))

        # The teacher's own reply never notifies the teacher.
        self.assertEqual(sum(n["kind"] == "COMMENT" for n in self.bell(self.teacher)[1]), 1)

    def test_reminder_to_continue_an_idle_course(self):
        self.enroll()
        first = lessons_of(self.course)[0]
        self.client.post(f"/api/v1/learning/lessons/{first.id}/progress/", {"completed": True}, format="json")

        # Opened recently: no reminder yet.
        self.bell(self.student)
        self.assertFalse(Notification.objects.filter(kind="REMINDER").exists())

        # Three days later, checking the bell creates one reminder, linking to where they stopped.
        LessonProgress.objects.update(updated_at=timezone.now() - timedelta(days=3))
        Enrollment.objects.update(activated_at=timezone.now() - timedelta(days=3))
        cache.clear()
        _, items = self.bell(self.student)
        reminder = next(n for n in items if n["kind"] == "REMINDER")
        self.assertEqual(reminder["title"], "Continue Python 101")
        self.assertIn("50% through", reminder["message"])
        self.assertTrue(reminder["link"].startswith("/learn/python-101"))

        # Not again for a few days.
        cache.clear()
        self.bell(self.student)
        self.assertEqual(Notification.objects.filter(kind="REMINDER").count(), 1)

    def test_reading_clears_the_badge(self):
        self.enroll()
        unread, items = self.bell(self.student)
        self.assertEqual(unread, 1)
        self.client.post(f"/api/v1/notifications/{items[0]['id']}/read/")
        self.assertEqual(self.bell(self.student)[0], 0)
        self.client.post("/api/v1/notifications/read-all/")

    def test_admin_links_open_the_admin_portal(self):
        admin = make_admin()
        Notification.objects.create(user=admin, kind="PAYMENT", title="Payment to verify", data={"course": "python-101"})
        Notification.objects.create(user=admin, kind="SYSTEM", title="Course submitted", data={"course": "python-101"})
        _, items = self.bell(admin)
        self.assertEqual({n["link"] for n in items}, {"/admin/payments", "/admin/courses/python-101"})

    def test_bell_needs_login(self):
        self.assertEqual(self.client.get("/api/v1/notifications/unread-count/").status_code, 401)


class ReminderEmailTests(APITestCase):
    """The daily send_reminders job: polite emails for students, teachers and admins, never repeated."""

    def setUp(self):
        from django.core import mail
        self.outbox = mail.outbox
        cache.clear()
        self.teacher = make_teacher()
        self.course = make_course("python-101", price="0", teacher=self.teacher, lessons=2)
        self.student = make_user()
        self.client.force_authenticate(self.student)
        self.client.post("/api/v1/courses/python-101/enroll/")
        self.outbox.clear()

    def run_job(self):
        from django.core.management import call_command
        from io import StringIO
        out = StringIO()
        call_command("send_reminders", stdout=out)
        return out.getvalue()

    def test_student_gets_a_kind_email_once(self):
        self.assertIn("0 students", self.run_job())  # just enrolled: too soon
        Enrollment.objects.update(activated_at=timezone.now() - timedelta(days=3))
        self.assertIn("1 students", self.run_job())
        self.assertEqual(len(self.outbox), 1)
        email = self.outbox[0]
        self.assertEqual(email.to, [self.student.email])
        self.assertEqual(email.subject, "Continue Python 101")
        self.assertIn("gentle reminder", email.body)
        self.assertIn("/learn/python-101", email.body)

        self.run_job()  # the next day's run doesn't repeat it
        self.assertEqual(len(self.outbox), 1)

    def test_teacher_and_admin_hear_about_waiting_work(self):
        from apps.courses.models import CourseModule, Quiz, QuizQuestion
        from apps.learning.models import QuizAttempt
        from apps.payments.models import Payment

        quiz = Quiz.objects.create(module=CourseModule.objects.get(course=self.course), title="Check")
        QuizQuestion.objects.create(quiz=quiz, kind="WRITTEN", prompt="Explain")
        enrollment = Enrollment.objects.get(student=self.student)
        attempt = QuizAttempt.objects.create(enrollment=enrollment, quiz=quiz, status="PENDING", answers=["…"])
        QuizAttempt.objects.filter(pk=attempt.pk).update(created_at=timezone.now() - timedelta(days=2))

        admin = make_admin()
        paid = make_course("design-1", price="500", teacher=self.teacher)
        pending = Enrollment.objects.create(student=self.student, course=paid, status=Enrollment.Status.PENDING_PAYMENT)
        payment = Payment.objects.create(student=self.student, course=paid, enrollment=pending, amount=500,
                                         journal_number="J123", status=Payment.Status.PENDING)
        Payment.objects.filter(pk=payment.pk).update(created_at=timezone.now() - timedelta(days=2))

        self.run_job()
        by_person = {m.to[0]: m for m in self.outbox}
        self.assertIn("1 student is waiting for your feedback", by_person[self.teacher.email].subject)
        self.assertIn("/teach/reviews", by_person[self.teacher.email].body)
        self.assertIn("1 payment to verify", by_person[admin.email].subject)

        self.outbox.clear()
        self.run_job()  # once a day at most
        self.assertEqual(len(self.outbox), 0)
