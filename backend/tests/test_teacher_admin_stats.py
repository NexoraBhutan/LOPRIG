from django.test import override_settings
from rest_framework.test import APITestCase

from apps.enrollments.models import Enrollment
from apps.learning.models import LessonProgress, LessonView

from .factories import lessons_of, make_admin, make_course, make_teacher, make_user


class TeacherLessonStatsTests(APITestCase):
    """Teachers see, for every lesson, how many students watched it and how many finished it."""

    def test_viewers_and_completions_per_lesson(self):
        teacher = make_teacher()
        course = make_course("python-101", teacher=teacher, lessons=2)
        first, second = lessons_of(course)
        for i in range(3):
            student = make_user(email=f"s{i}@example.com")
            enrollment = Enrollment.objects.create(student=student, course=course, status=Enrollment.Status.ACTIVE)
            LessonView.objects.create(lesson=first, student=student)
            LessonProgress.objects.create(enrollment=enrollment, lesson=first, completed=i < 2)

        self.client.force_authenticate(teacher)
        course_data = self.client.get(f"/api/v1/teach/courses/{course.slug}/").data
        lessons = {lesson["id"]: lesson for module in course_data["modules"] for lesson in module["lessons"]}
        self.assertEqual((lessons[first.id]["viewers"], lessons[first.id]["completed"]), (3, 2))
        self.assertEqual((lessons[second.id]["viewers"], lessons[second.id]["completed"]), (0, 0))


@override_settings(RMA_GATEWAY_MODE="preview")
class AdminSeesBankPaymentDetailsTests(APITestCase):
    def test_bank_details_are_listed_for_bank_payments(self):
        make_course("paid-course", price="499", lessons=1)
        self.client.force_authenticate(make_user())
        self.client.post("/api/v1/payments/bank/", {
            "course": "paid-course", "bank": "bnb", "account_last4": "4321", "purpose": "Course fee",
            "remarks": "", "transaction_id": "RMA-PREVIEW-T1",
        }, format="json")
        self.client.force_authenticate(make_admin())
        payment = self.client.get("/api/v1/manage/payments/").data["results"][0]
        self.assertEqual(payment["provider"], "rma")
        self.assertEqual(payment["bank"]["name"], "Bhutan National Bank")
        self.assertEqual(payment["bank"]["account_last4"], "4321")
        self.assertTrue(payment["bank"]["test"])
