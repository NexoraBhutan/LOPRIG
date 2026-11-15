from django.core import mail
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.enrollments.models import Enrollment
from apps.payments.invoice import build_receipt_pdf
from apps.payments.models import Payment, PaymentSettings

from .factories import make_admin, make_course, make_user

URL = "/api/v1/payments/bank/"


@override_settings(RMA_GATEWAY_MODE="preview")
class BankPaymentTests(APITestCase):
    """Paying from a bank account (RMA gateway): one payment per course, receipt by email, admin unlocks."""

    def setUp(self):
        self.admin = make_admin()
        self.student = make_user(name="Karma Dema")
        self.course = make_course("paid-course", price="499", lessons=2)
        settings = PaymentSettings.load()
        settings.account_name = "Nexora Bhutan Pvt Ltd"
        settings.bank_name = "Bank of Bhutan"
        settings.account_number = "200112345678"
        settings.alert_email = "owner@gmail.com"
        settings.save()

    def pay(self, transaction_id="RMA-PREVIEW-ABC123", student=None, **extra):
        self.client.force_authenticate(student or self.student)
        body = {"course": "paid-course", "bank": "bob", "account_last4": "6789", "purpose": "Course fee",
                "remarks": "Python course", "transaction_id": transaction_id, **extra}
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(URL, body, format="json")

    def test_payment_is_recorded_and_the_student_gets_a_receipt(self):
        res = self.pay()
        self.assertEqual(res.status_code, 201, res.data)
        payment = Payment.objects.get(reference=res.data["reference"])
        self.assertEqual((payment.provider, payment.status), (Payment.RMA, Payment.Status.PENDING))
        self.assertEqual(payment.raw_event["account_last4"], "6789")
        self.assertNotIn("account_number", payment.raw_event)  # only the last 4 digits are kept

        student_mail = next(m for m in mail.outbox if m.to == [self.student.email])
        self.assertIn("Payment received", student_mail.subject)
        body = student_mail.alternatives[0][0]
        for text in ("Congratulations, Karma", "We have received your payment", "Category", "Bank of Bhutan account ending 6789",
                     "Test payment"):
            self.assertIn(text, body)
        name, pdf, mimetype = student_mail.attachments[0]
        self.assertEqual(mimetype, "application/pdf")
        self.assertTrue(pdf.startswith(b"%PDF-1.4") and pdf.rstrip().endswith(b"%%EOF"))
        self.assertIn(b"PAYMENT RECEIPT", pdf)
        self.assertIn(b"Nexora Bhutan Pvt Ltd", pdf)

        alert = next(m for m in mail.outbox if m.to == ["owner@gmail.com"])
        self.assertIn("Bank payment", alert.subject)

    def test_cannot_pay_twice_for_the_same_course(self):
        self.assertEqual(self.pay().status_code, 201)
        again = self.pay(transaction_id="RMA-PREVIEW-XYZ789")
        self.assertEqual(again.status_code, 409)
        self.assertEqual(again.data["detail"], "You have already paid for this course.")
        self.assertEqual(Payment.objects.count(), 1)

    def test_admin_approval_unlocks_the_course(self):
        reference = self.pay().data["reference"]
        self.client.force_authenticate(self.admin)
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(f"/api/v1/manage/payments/{reference}/approve/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(Enrollment.objects.get(student=self.student).status, Enrollment.Status.ACTIVE)
        self.assertIn("Transaction ref.", mail.outbox[-1].alternatives[0][0])
        # Paid and unlocked: still can't pay again.
        self.assertEqual(self.pay(transaction_id="RMA-PREVIEW-NEW999").status_code, 409)

    def test_a_qr_payment_is_refused_while_a_bank_payment_waits(self):
        self.pay()
        from .test_qr_payments import png
        self.client.force_authenticate(self.student)
        res = self.client.post("/api/v1/payments/qr/submit/", {
            "course": "paid-course", "journal_number": "126-812333463", "proof": png(), "contact_number": "17123456",
        }, format="multipart")
        self.assertIn(res.status_code, (400, 409))

    def test_validation(self):
        self.assertEqual(self.pay(bank="unknown").status_code, 400)
        self.assertEqual(self.pay(account_last4="12").status_code, 400)
        self.client.force_authenticate(make_admin(email="other-admin@example.com"))
        self.assertEqual(self.client.post(URL, {}, format="json").status_code, 403)

    @override_settings(RMA_GATEWAY_MODE="off")
    def test_off_mode_refuses_bank_payments(self):
        self.assertEqual(self.pay().status_code, 400)
        self.assertFalse(Payment.objects.exists())


class ReceiptPdfTests(APITestCase):
    def test_pdf_handles_any_text(self):
        pdf = build_receipt_pdf(
            number="LR-1", issued="15 Nov 2026", student=("Pema (Dorji)", "p@example.com"), payee=("Lop-rig", "BoB"),
            items=[("Course", "རྫོང་ཁ Dzongkha basics \\ (A1)")], payment=[("Amount paid", "Nu. 499")],
            amount="Nu. 499", status="Paid", test_mode=True,
        )
        self.assertTrue(pdf.startswith(b"%PDF") and b"TEST RECEIPT" in pdf)
