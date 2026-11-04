import json

from django.test import override_settings
from rest_framework.test import APITestCase

from apps.enrollments.models import Enrollment
from apps.notifications.models import Notification
from apps.payments.gateways.mock import MockGateway, sign
from apps.payments.models import Payment

from .factories import make_course, make_teacher, make_user

WEBHOOK = "/api/v1/payments/webhooks/mock/"


class FreeEnrollmentTests(APITestCase):
    def setUp(self):
        self.student = make_user()
        self.course = make_course("free-course", price="0")
        self.url = "/api/v1/courses/free-course/enroll/"

    def test_enroll_free_course_once(self):
        self.client.force_authenticate(self.student)
        first = self.client.post(self.url)
        again = self.client.post(self.url)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.data["status"], "ACTIVE")
        self.assertEqual(again.status_code, 200)
        self.course.refresh_from_db()
        self.assertEqual(self.course.students_count, 1)
        self.assertEqual(Notification.objects.filter(user=self.student, kind="ENROLLMENT").count(), 1)

    def test_enrolled_course_appears_in_my_courses(self):
        self.client.force_authenticate(self.student)
        self.client.post(self.url)
        res = self.client.get("/api/v1/enrollments/")
        self.assertEqual([e["course"]["id"] for e in res.data["results"]], ["free-course"])
        self.assertEqual(res.data["results"][0]["progress"], 0)
        self.assertEqual(self.client.get("/api/v1/enrollments/free-course/").status_code, 200)

    @override_settings(PAYMENTS_ENABLED=True)
    def test_paid_course_needs_checkout(self):
        make_course("paid-course", price="500")
        self.client.force_authenticate(self.student)
        res = self.client.post("/api/v1/courses/paid-course/enroll/")
        self.assertEqual(res.status_code, 402)
        self.assertFalse(Enrollment.objects.filter(status=Enrollment.Status.ACTIVE).exists())

    def test_only_students_can_enroll(self):
        self.assertEqual(self.client.post(self.url).status_code, 401)
        self.client.force_authenticate(make_teacher(email="t2@example.com"))
        self.assertEqual(self.client.post(self.url).status_code, 403)

    def test_saved_courses(self):
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.post("/api/v1/saved-courses/", {"course": "free-course"}).status_code, 201)
        self.assertEqual(self.client.post("/api/v1/saved-courses/", {"course": "free-course"}).status_code, 200)
        self.assertEqual(self.client.get("/api/v1/saved-courses/").data["count"], 1)
        self.assertEqual(self.client.delete("/api/v1/saved-courses/free-course/").status_code, 204)
        self.assertEqual(self.client.get("/api/v1/saved-courses/").data["count"], 0)


@override_settings(PAYMENTS_ENABLED=True, PAYMENT_PROVIDER="mock")
class PaymentTests(APITestCase):
    def setUp(self):
        self.student = make_user()
        self.course = make_course("paid-course", price="900", discount="500")
        self.client.force_authenticate(self.student)

    def checkout(self, slug="paid-course"):
        return self.client.post("/api/v1/payments/checkout/", {"course": slug})

    def enrollment(self):
        return Enrollment.objects.get(student=self.student, course=self.course)

    def post_webhook(self, payload: dict, signature: str | None = None):
        body = json.dumps(payload).encode()
        return self.client.post(
            WEBHOOK, body, content_type="application/json",
            HTTP_X_LOPRIG_SIGNATURE=signature if signature is not None else sign(body),
        )

    def test_checkout_creates_pending_payment_without_access(self):
        res = self.checkout()
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["payment"]["amount"], 500)
        self.assertEqual(res.data["payment"]["status"], "PENDING")
        self.assertIn("checkout_url", res.data)
        self.assertEqual(self.enrollment().status, Enrollment.Status.PENDING_PAYMENT)
        self.assertEqual(self.client.get("/api/v1/learning/courses/paid-course/").status_code, 403)

    def test_repeat_checkout_reuses_pending_payment(self):
        first = self.checkout().data["payment"]["reference"]
        second = self.checkout().data["payment"]["reference"]
        self.assertEqual(first, second)
        self.assertEqual(Payment.objects.count(), 1)

    def test_price_change_cancels_old_pending_payment(self):
        old_ref = self.checkout().data["payment"]["reference"]
        self.course.discount_price = 400
        self.course.save()
        new = self.checkout().data["payment"]
        self.assertNotEqual(new["reference"], old_ref)
        self.assertEqual(new["amount"], 400)
        self.assertEqual(Payment.objects.get(reference=old_ref).status, Payment.Status.CANCELLED)

    def test_checkout_rejects_free_and_already_owned_courses(self):
        make_course("free-course", price="0")
        self.assertEqual(self.checkout("free-course").status_code, 400)
        ref = self.checkout().data["payment"]["reference"]
        self.client.post(f"/api/v1/payments/mock/{ref}/pay/", {"outcome": "success"})
        self.assertEqual(self.checkout().status_code, 409)

    def test_successful_payment_unlocks_course(self):
        ref = self.checkout().data["payment"]["reference"]
        res = self.client.post(f"/api/v1/payments/mock/{ref}/pay/", {"outcome": "success"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "SUCCEEDED")
        self.assertEqual(self.enrollment().status, Enrollment.Status.ACTIVE)
        self.assertEqual(self.client.get("/api/v1/learning/courses/paid-course/").status_code, 200)
        self.assertTrue(Notification.objects.filter(user=self.student, title="Payment received").exists())

    def test_webhook_replay_is_ignored(self):
        ref = self.checkout().data["payment"]["reference"]
        payment = Payment.objects.get(reference=ref)
        body, headers = MockGateway().build_event(payment, succeeded=True)
        for _ in range(3):
            res = self.client.post(WEBHOOK, body, content_type="application/json",
                                   HTTP_X_LOPRIG_SIGNATURE=headers["X-Loprig-Signature"])
            self.assertEqual(res.status_code, 200)
        self.course.refresh_from_db()
        self.assertEqual(self.course.students_count, 1)
        self.assertEqual(Notification.objects.filter(user=self.student, kind="ENROLLMENT").count(), 1)

    def test_forged_webhook_is_rejected(self):
        ref = self.checkout().data["payment"]["reference"]
        payload = {"reference": ref, "status": "succeeded", "amount": "500.00", "currency": "BTN"}
        self.assertEqual(self.post_webhook(payload, signature="not-the-real-signature").status_code, 400)
        self.assertEqual(self.post_webhook(payload, signature="").status_code, 400)
        self.assertEqual(Payment.objects.get(reference=ref).status, Payment.Status.PENDING)
        self.assertEqual(self.enrollment().status, Enrollment.Status.PENDING_PAYMENT)

    def test_signed_webhook_with_wrong_amount_fails_payment(self):
        ref = self.checkout().data["payment"]["reference"]
        res = self.post_webhook({"reference": ref, "status": "succeeded", "amount": "1.00", "currency": "BTN"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(Payment.objects.get(reference=ref).status, Payment.Status.FAILED)
        self.assertEqual(self.enrollment().status, Enrollment.Status.PENDING_PAYMENT)

    def test_unknown_reference_and_provider(self):
        res = self.post_webhook({"reference": "pay_doesnotexist", "status": "succeeded", "amount": "1", "currency": "BTN"})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(self.client.post("/api/v1/payments/webhooks/stripe/", {}).status_code, 404)

    def test_failed_payment_then_retry(self):
        ref = self.checkout().data["payment"]["reference"]
        failed = self.client.post(f"/api/v1/payments/mock/{ref}/pay/", {"outcome": "failure"})
        self.assertEqual(failed.data["status"], "FAILED")
        self.assertEqual(self.enrollment().status, Enrollment.Status.PENDING_PAYMENT)
        retry = self.checkout()
        self.assertEqual(retry.status_code, 201)
        self.assertNotEqual(retry.data["payment"]["reference"], ref)

    def test_students_only_see_their_own_payments(self):
        ref = self.checkout().data["payment"]["reference"]
        self.client.force_authenticate(make_user(email="other@example.com"))
        self.assertEqual(self.client.get(f"/api/v1/payments/{ref}/").status_code, 404)
        self.assertEqual(self.client.post(f"/api/v1/payments/mock/{ref}/pay/", {"outcome": "success"}).status_code, 404)
        self.assertEqual(self.client.get("/api/v1/payments/").data["count"], 0)


@override_settings(PAYMENTS_ENABLED=False)
class PaymentsSwitchedOffTests(APITestCase):
    """Until a gateway is chosen, every course is free to join; prices are kept for later."""

    def setUp(self):
        self.student = make_user()
        self.course = make_course("paid-course", price="499")

    def test_paid_course_enrolls_for_free(self):
        self.client.force_authenticate(self.student)
        res = self.client.post("/api/v1/courses/paid-course/enroll/")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["status"], "ACTIVE")
        self.assertEqual(Payment.objects.count(), 0)

    def test_catalogue_shows_free_but_keeps_the_real_price(self):
        listed = self.client.get("/api/v1/courses/paid-course/").data
        self.assertEqual((listed["price"], listed["discount_price"]), (0.0, 0.0))
        self.course.refresh_from_db()
        self.assertEqual(int(self.course.price), 499)

    def test_checkout_is_refused(self):
        self.client.force_authenticate(self.student)
        res = self.client.post("/api/v1/payments/checkout/", {"course": "paid-course"})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(Payment.objects.count(), 0)

    def test_public_config_reports_the_switch(self):
        self.assertEqual(self.client.get("/api/v1/config/").data, {"payments_enabled": False})
