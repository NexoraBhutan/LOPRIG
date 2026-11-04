import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.enrollments.models import Enrollment
from apps.notifications.models import Notification
from apps.payments.models import Payment, PaymentSettings

from .factories import lessons_of, make_admin, make_course, make_user

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
MEDIA = tempfile.mkdtemp()


def png(name="receipt.png"):
    return SimpleUploadedFile(name, PNG, content_type="image/png")


@override_settings(MEDIA_ROOT=MEDIA, PAYMENTS_ENABLED=True, PAYMENT_PROVIDER="qr")
class QrPaymentTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.admin = make_admin()
        self.student = make_user()
        self.course = make_course("paid-course", price="3400", lessons=2)
        self.locked = lessons_of(self.course)[1]

    def set_up_qr(self):
        self.client.force_authenticate(self.admin)
        res = self.client.patch("/api/v1/manage/payment-settings/", {
            "qr_image": png("qr.png"), "account_name": "Norbu Tshering", "bank_name": "Bank of Bhutan",
        }, format="multipart")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data["ready"])

    def submit(self, journal="126-812333463", proof=None, student=None, phone="+975 17 12 34 56"):
        self.client.force_authenticate(student or self.student)
        return self.client.post("/api/v1/payments/qr/submit/", {
            "course": "paid-course", "journal_number": journal, "proof": proof or png(), "contact_number": phone,
        }, format="multipart")

    def test_cannot_pay_before_the_admin_adds_a_qr(self):
        res = self.submit()
        self.assertEqual(res.status_code, 400)
        self.assertIn("aren't set up", str(res.data))

    def test_submit_verify_unlock(self):
        self.set_up_qr()
        qr = self.client.get("/api/v1/payments/qr/").data
        self.assertTrue(qr["ready"])
        self.assertTrue(qr["qr_image"].endswith(".png"))
        self.assertEqual(qr["account_name"], "Norbu Tshering")

        res = self.submit(journal=" 126-812333463 ")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual((res.data["status"], res.data["journal_number"]), ("PENDING", "126-812333463"))
        self.assertEqual(res.data["contact_number"], "17123456")
        self.assertEqual(res.data["amount"], 3400)
        # Not unlocked until an admin checks the bank statement.
        self.assertEqual(self.client.get(f"/api/v1/learning/lessons/{self.locked.id}/").status_code, 403)
        self.assertTrue(Notification.objects.filter(user=self.admin, title="Payment to verify").exists())
        self.assertEqual(self.submit(journal="999-1").status_code, 409)  # already under review
        mine = self.client.get("/api/v1/payments/?course=paid-course").data["results"]
        self.assertEqual(mine[0]["status"], "PENDING")

        reference = res.data["reference"]
        self.assertEqual(self.client.get(f"/api/v1/manage/payments/{reference}/proof/").status_code, 403)
        self.client.force_authenticate(self.admin)
        row = self.client.get("/api/v1/manage/payments/?status=PENDING").data["results"][0]
        self.assertEqual((row["journal_number"], row["contact_number"], row["has_proof"]), ("126-812333463", "17123456", True))
        proof = self.client.get(f"/api/v1/manage/payments/{reference}/proof/")
        self.assertEqual(b"".join(proof.streaming_content), PNG)

        approved = self.client.post(f"/api/v1/manage/payments/{reference}/approve/")
        self.assertEqual(approved.data["status"], "SUCCEEDED")
        self.assertEqual(approved.data["reviewed_by"], "Boss")
        self.assertEqual(Enrollment.objects.get(student=self.student).status, Enrollment.Status.ACTIVE)
        self.assertTrue(Notification.objects.filter(user=self.student, title="Payment confirmed").exists())
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get(f"/api/v1/learning/lessons/{self.locked.id}/").status_code, 200)

    def test_rejected_payment_can_be_submitted_again(self):
        self.set_up_qr()
        reference = self.submit().data["reference"]
        self.client.force_authenticate(self.admin)
        rejected = self.client.post(f"/api/v1/manage/payments/{reference}/reject/", {"reason": "No such transfer found."})
        self.assertEqual((rejected.data["status"], rejected.data["failure_reason"]), ("FAILED", "No such transfer found."))
        self.assertEqual(self.client.post(f"/api/v1/manage/payments/{reference}/approve/").status_code, 400)
        self.assertTrue(Notification.objects.filter(user=self.student, title="Payment not verified").exists())
        self.assertEqual(self.submit(journal="126-812333999").status_code, 201)

    def test_one_journal_number_unlocks_one_course(self):
        self.set_up_qr()
        self.submit()
        other = self.submit(student=make_user(email="other@example.com"))
        self.assertEqual(other.status_code, 400)
        self.assertIn("already been used", str(other.data["journal_number"]))

    def test_bad_proof_or_journal_is_refused(self):
        self.set_up_qr()
        fake = SimpleUploadedFile("receipt.png", b"%PDF-1.4 not an image", content_type="image/png")
        self.assertIn("PNG, JPG or WebP", str(self.submit(proof=fake).data["proof"]))
        self.assertEqual(self.submit(journal="#!").status_code, 400)
        for bad in ["", "12345", "17-12-34-567", "+91 9876543210"]:
            res = self.submit(phone=bad)
            self.assertEqual(res.status_code, 400, bad)
            self.assertIn("contact_number", res.data)
        self.assertEqual(Payment.objects.count(), 0)

    def test_free_courses_need_no_payment(self):
        self.set_up_qr()
        make_course("free-course", price="0")
        self.client.force_authenticate(self.student)
        res = self.client.post("/api/v1/payments/qr/submit/", {
            "course": "free-course", "journal_number": "126-1", "proof": png(), "contact_number": "17123456",
        }, format="multipart")
        self.assertEqual(res.status_code, 400)

    def test_old_gateway_checkout_is_off(self):
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.post("/api/v1/payments/checkout/", {"course": "paid-course"}).status_code, 400)

    def test_only_admins_edit_the_qr(self):
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.patch("/api/v1/manage/payment-settings/", {"account_name": "Me"}).status_code, 403)
        self.assertEqual(PaymentSettings.load().account_name, "")


@override_settings(PAYMENTS_ENABLED=True)
class FreeCourseOpenAccessTests(APITestCase):
    def setUp(self):
        self.free = make_course("free-course", price="0", lessons=2)
        self.paid = make_course("paid-course", price="499", lessons=2)

    def test_visitors_watch_every_lesson_of_a_free_course(self):
        locked = lessons_of(self.free)[1]
        self.assertFalse(locked.is_preview)
        self.assertEqual(self.client.get(f"/api/v1/learning/lessons/{locked.id}/").status_code, 200)
        player = self.client.get("/api/v1/learning/courses/free-course/")
        self.assertEqual(player.status_code, 200)
        self.assertEqual(player.data["status"], "OPEN")
        self.assertEqual(player.data["progress"]["total_lessons"], 2)

    def test_students_are_enrolled_quietly_so_progress_counts(self):
        student = make_user()
        self.client.force_authenticate(student)
        lesson = lessons_of(self.free)[1]
        res = self.client.post(f"/api/v1/learning/lessons/{lesson.id}/progress/", {"completed": True})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(Enrollment.objects.get(student=student, course=self.free).status, Enrollment.Status.ACTIVE)

    def test_paid_courses_stay_locked(self):
        locked = lessons_of(self.paid)[1]
        self.assertEqual(self.client.get(f"/api/v1/learning/lessons/{locked.id}/").status_code, 401)
        self.assertEqual(self.client.get("/api/v1/learning/courses/paid-course/").status_code, 401)
        self.client.force_authenticate(make_user())
        self.assertEqual(self.client.get("/api/v1/learning/courses/paid-course/").status_code, 403)


@override_settings(MEDIA_ROOT=MEDIA, PAYMENTS_ENABLED=True, PAYMENT_PROVIDER="qr", FRONTEND_URL="https://loprig.bt")
class QrPaymentEmailTests(APITestCase):
    def setUp(self):
        from django.core import mail

        self.outbox = mail.outbox
        self.admin = make_admin()
        self.student = make_user(name="Karma Dema")
        make_course("paid-course", price="3400", lessons=1)
        settings = PaymentSettings.load()
        settings.qr_image = png("qr.png")
        settings.account_name = "Norbu Tshering"
        settings.alert_email = "owner@gmail.com"
        settings.save()

    def submit(self):
        self.client.force_authenticate(self.student)
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post("/api/v1/payments/qr/submit/", {
                "course": "paid-course", "journal_number": "126-812333463", "proof": png(), "contact_number": "17123456",
            }, format="multipart")
        self.assertEqual(res.status_code, 201, res.data)
        return res.data["reference"]

    def review(self, reference, action, body=None):
        self.client.force_authenticate(self.admin)
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(f"/api/v1/manage/payments/{reference}/{action}/", body or {})

    def test_owner_is_emailed_in_the_students_words_with_the_screenshot(self):
        self.submit()
        email = self.outbox[-1]
        self.assertEqual(email.to, ["owner@gmail.com"])
        self.assertEqual(email.reply_to, [self.student.email])
        self.assertIn("Karma Dema paid Nu. 3,400", email.subject)
        self.assertIn("My name is Karma Dema", email.body)
        self.assertIn("126-812333463", email.body)
        self.assertIn("17123456", email.body)
        self.assertIn("https://loprig.bt/admin/payments", email.body)
        self.assertEqual(len(email.attachments), 1)
        self.assertEqual(email.attachments[0][1], PNG)
        self.assertIn("My name is <strong>Karma Dema</strong>", email.alternatives[0][0])

    def test_student_gets_a_thank_you_once_approved(self):
        reference = self.submit()
        self.review(reference, "approve")
        email = self.outbox[-1]
        self.assertEqual(email.to, [self.student.email])
        self.assertEqual(email.reply_to, ["owner@gmail.com"])
        self.assertIn("Payment confirmed", email.subject)
        self.assertIn("Dear Karma", email.body)
        self.assertIn("Thank you so much for your payment", email.body)
        self.assertIn("https://loprig.bt/learn/paid-course", email.body)

    def test_student_is_told_why_when_rejected(self):
        reference = self.submit()
        self.review(reference, "reject", {"reason": "No such transfer found."})
        email = self.outbox[-1]
        self.assertEqual(email.to, [self.student.email])
        self.assertIn("couldn't verify", email.subject)
        self.assertIn("No such transfer found.", email.body)
        self.assertIn("https://loprig.bt/checkout/paid-course", email.body)

    def test_without_an_owner_email_every_admin_is_alerted(self):
        PaymentSettings.objects.update(alert_email="")
        self.submit()
        self.assertEqual(self.outbox[-1].to, [self.admin.email])

    def test_a_mail_failure_never_loses_the_payment(self):
        from unittest import mock

        with mock.patch("django.core.mail.EmailMultiAlternatives.send", side_effect=OSError("smtp down")):
            self.submit()
        self.assertEqual(Payment.objects.get().status, Payment.Status.PENDING)
