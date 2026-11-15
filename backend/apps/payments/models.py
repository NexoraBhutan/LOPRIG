import secrets
import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


def generate_reference() -> str:
    return f"pay_{secrets.token_hex(10)}"


def _random_name(folder: str, filename: str) -> str:
    """Never keep the uploader's file name (it can contain personal details)."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    return f"{folder}/{uuid.uuid4().hex}.{ext}"


def proof_upload_path(instance, filename: str) -> str:
    return _random_name("payment-proofs", filename)


def qr_upload_path(instance, filename: str) -> str:
    return _random_name("payment-qr", filename)


class Payment(models.Model):
    """One payment attempt.

    Bank QR ("qr"): the student pays by scanning Lop-rig's QR in their bank app, then submits the
    journal number and a screenshot. An admin checks it against the bank statement and approves
    (SUCCEEDED, course unlocked) or rejects (FAILED, with a reason; the student can submit again).
    Gateway providers: only a verified webhook can move it to SUCCEEDED.
    """

    QR = "qr"
    RMA = "rma"  # paid from the student's bank account through the RMA payment gateway

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SUCCEEDED = "SUCCEEDED", "Succeeded"
        FAILED = "FAILED", "Failed"
        CANCELLED = "CANCELLED", "Cancelled"

    reference = models.CharField(max_length=40, unique=True, default=generate_reference, editable=False)
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="payments")
    course = models.ForeignKey("courses.Course", on_delete=models.PROTECT, related_name="payments")
    enrollment = models.ForeignKey("enrollments.Enrollment", on_delete=models.PROTECT, related_name="payments")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="BTN")
    provider = models.CharField(max_length=30)
    provider_reference = models.CharField(max_length=120, blank=True, db_index=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING, db_index=True)
    failure_reason = models.CharField(max_length=255, blank=True)
    raw_event = models.JSONField(default=dict, blank=True, help_text="Last verified webhook payload, for audits.")
    paid_at = models.DateTimeField(null=True, blank=True)
    # Bank QR proof, checked by an admin.
    journal_number = models.CharField(max_length=40, blank=True, db_index=True,
                                      help_text="Bank journal / transaction number from the receipt.")
    proof = models.FileField(upload_to=proof_upload_path, blank=True, help_text="Payment screenshot.")
    contact_number = models.CharField(max_length=20, blank=True,
                                      help_text="Student's phone, so an admin can call if the payment doesn't match.")
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                    related_name="reviewed_payments")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "payments"
        ordering = ["-created_at"]
        constraints = [
            # One bank transfer can only unlock one course.
            models.UniqueConstraint(
                fields=["journal_number"],
                condition=~Q(journal_number="") & Q(status__in=["PENDING", "SUCCEEDED"]),
                name="journal_number_used_once",
            ),
        ]

    def __str__(self):
        return f"{self.reference} {self.amount} {self.currency} ({self.status})"


class PaymentSettings(models.Model):
    """Where students send money: Lop-rig's bank QR code. A single row, edited by admins."""

    qr_image = models.FileField(upload_to=qr_upload_path, blank=True)
    account_name = models.CharField(max_length=120, blank=True, help_text="Name shown in the bank app, e.g. Norbu Tshering.")
    bank_name = models.CharField(max_length=80, blank=True, help_text="e.g. Bank of Bhutan (mBoB).")
    account_number = models.CharField(max_length=40, blank=True, help_text="Optional, for students who type it in.")
    instructions = models.TextField(blank=True, help_text="Extra notes shown under the QR code.")
    alert_email = models.EmailField(blank=True, help_text=(
        "Gmail of the account holder. Gets an email the moment a student submits a payment. "
        "Empty = every active admin is emailed."))
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "payment_settings"
        verbose_name = verbose_name_plural = "QR payment settings"

    def __str__(self):
        return "QR payment settings"

    @classmethod
    def load(cls) -> "PaymentSettings":
        return cls.objects.get_or_create(pk=1)[0]

    @property
    def is_ready(self) -> bool:
        return bool(self.qr_image and self.account_name)
