"""Payment emails for bank QR payments.

1. Student submits proof -> the account holder gets an email written in the student's voice,
   with the screenshot attached and Reply-To set to the student.
2. Admin approves -> the student gets a warm thank-you email; rejects -> a polite email with the reason.

Emails go out after the database change is committed and never raise: a Gmail hiccup must not
undo or block a payment. Failures are logged.
"""
import logging
import mimetypes
from html import escape

from django.db import transaction
from django.utils import timezone

from apps.notifications.emails import details_table as _details_table
from apps.notifications.emails import layout as _layout
from apps.notifications.emails import send
from apps.notifications.emails import site as _site
from apps.users.models import User

from .models import Payment, PaymentSettings

logger = logging.getLogger(__name__)


def _money(amount) -> str:
    return f"Nu. {amount:,.0f}"


def _when(dt) -> str:
    return timezone.localtime(dt).strftime("%d %b %Y, %I:%M %p")


def _send(subject: str, to: list[str], text: str, html: str, reply_to: list[str] | None = None,
          attach_proof: Payment | None = None) -> None:
    """Never raises: SMTP down, bad password, ... is logged, so it can't break the payment."""
    attachments = []
    if attach_proof and attach_proof.proof:
        try:
            with attach_proof.proof.open("rb") as f:
                content = f.read()
            name = f"payment-{attach_proof.journal_number or attach_proof.reference}"
            ext = attach_proof.proof.name.rsplit(".", 1)[-1]
            attachments.append((f"{name}.{ext}", content, mimetypes.guess_type(f"x.{ext}")[0] or "image/png"))
        except OSError:
            logger.warning("Couldn't attach the screenshot for payment %s", attach_proof.reference)
    send(subject, to, text, html, reply_to=reply_to, attachments=attachments)


def _alert_recipients() -> list[str]:
    owner = PaymentSettings.load().alert_email
    if owner:
        return [owner]
    return list(User.objects.filter(role=User.Role.ADMIN, is_active=True).values_list("email", flat=True))


# --- 1. To the account holder: "I've paid" ---------------------------------------------------

def payment_submitted(payment: Payment) -> None:
    student, course = payment.student, payment.course
    review = _site(f"/admin/payments?review={payment.reference}")  # opens this payment's review
    rows = [
        ("Course", course.title),
        ("Amount paid", _money(payment.amount)),
        ("Journal no.", payment.journal_number),
        ("Contact no.", payment.contact_number or "—"),
        ("Email", student.email),
        ("Submitted", _when(payment.created_at)),
    ]
    subject = f"Payment confirmation: {student.name} paid {_money(payment.amount)} for {course.title}"
    text = (
        "Dear Sir/Madam,\n\n"
        f"My name is {student.name}. I'm writing to let you know that I have completed my payment "
        f"of {_money(payment.amount)} for the course \"{course.title}\" on Lop-rig, by scanning the "
        "payment QR code.\n\n"
        + "".join(f"{k}: {v}\n" for k, v in rows)
        + "\nI have attached the screenshot of my payment. Kindly verify it and unlock the course "
        "for me when you can. If anything doesn't match, please contact me on the number above "
        "or simply reply to this email.\n\n"
        "Thank you very much for your time.\n\n"
        f"Warm regards,\n{student.name}\n\n"
        f"---\nReview this payment: {review}\n"
    )
    html = _layout(
        f"{student.name} paid {_money(payment.amount)}. Please verify.",
        f"<p style='margin:0 0 14px'>Dear Sir/Madam,</p>"
        f"<p style='margin:0 0 14px'>My name is <strong>{escape(student.name)}</strong>. I'm writing to let you know "
        f"that I have completed my payment of <strong>{_money(payment.amount)}</strong> for the course "
        f"<strong>“{escape(course.title)}”</strong> on Lop-rig, by scanning the payment QR code.</p>"
        f"{_details_table(rows)}"
        f"<p style='margin:0 0 14px'>I have attached the screenshot of my payment. Kindly verify it and unlock the "
        f"course for me when you can. If anything doesn't match, please contact me on the number above or simply "
        f"reply to this email.</p>"
        f"<p style='margin:0 0 4px'>Thank you very much for your time.</p>"
        f"<p style='margin:18px 0 0'>Warm regards,<br><strong>{escape(student.name)}</strong></p>",
        button=("Review and approve", review),
    )
    _send(subject, _alert_recipients(), text, html, reply_to=[student.email], attach_proof=payment)


# --- 2. To the student: verified -------------------------------------------------------------

def payment_approved(payment: Payment) -> None:
    student, course = payment.student, payment.course
    first = student.name.split(" ")[0] or student.name
    start = _site(f"/learn/{course.slug}")
    teacher = course.teacher.name
    rows = [("Course", course.title), ("Amount", _money(payment.amount)), ("Journal no.", payment.journal_number)]
    subject = f"Payment confirmed: welcome to {course.title}! 🎉"
    text = (
        f"Dear {first},\n\n"
        f"Thank you so much for your payment and for supporting learning on Lop-rig. We have verified "
        f"your payment of {_money(payment.amount)}, and \"{course.title}\" is now unlocked for you.\n\n"
        + "".join(f"{k}: {v}\n" for k, v in rows)
        + f"\nStart learning: {start}\n\n"
        f"Every expert was once a beginner. Take it one lesson at a time: a few minutes each day adds "
        f"up faster than you think. {teacher} and the whole Lop-rig family are cheering for you, and "
        f"when you finish every lesson you'll earn your certificate.\n\n"
        "If you need any help along the way, just reply to this email.\n\n"
        "Keep learning, keep growing!\n\nWith gratitude,\nThe Lop-rig team"
    )
    html = _layout(
        f"Your payment is verified. {course.title} is unlocked.",
        f"<p style='margin:0 0 14px;font-size:22px;font-weight:700'>Thank you, {escape(first)}! 🙏</p>"
        f"<p style='margin:0 0 14px'>Thank you so much for your payment and for supporting learning on Lop-rig. "
        f"We have verified your payment of <strong>{_money(payment.amount)}</strong>, and "
        f"<strong>“{escape(course.title)}”</strong> is now unlocked for you.</p>"
        f"{_details_table(rows)}"
        f"<p style='margin:0 0 14px'>Every expert was once a beginner. Take it one lesson at a time: a few minutes "
        f"each day adds up faster than you think. <strong>{escape(teacher)}</strong> and the whole Lop-rig family are "
        f"cheering for you, and when you finish every lesson you'll earn your certificate. 🏆</p>"
        f"<p style='margin:0 0 4px'>If you need any help along the way, just reply to this email.</p>"
        f"<p style='margin:18px 0 0'>Keep learning, keep growing!<br>With gratitude,<br><strong>The Lop-rig team</strong></p>",
        button=("Continue learning", start),
    )
    reply = PaymentSettings.load().alert_email
    _send(subject, [student.email], text, html, reply_to=[reply] if reply else None)


# --- 3. To the student: couldn't verify ------------------------------------------------------

def payment_rejected(payment: Payment) -> None:
    student, course = payment.student, payment.course
    first = student.name.split(" ")[0] or student.name
    retry = _site(f"/checkout/{course.slug}")
    subject = f"We couldn't verify your payment for {course.title}"
    text = (
        f"Dear {first},\n\n"
        f"Thank you for your interest in \"{course.title}\". Unfortunately we couldn't verify your payment "
        f"with journal number {payment.journal_number}.\n\n"
        f"Reason: {payment.failure_reason}\n\n"
        f"Please check the details and submit them again here: {retry}\n"
        "If money has already left your account, don't worry: reply to this email with your receipt and "
        "we'll sort it out together.\n\nKind regards,\nThe Lop-rig team"
    )
    html = _layout(
        "We couldn't verify your payment yet.",
        f"<p style='margin:0 0 14px'>Dear {escape(first)},</p>"
        f"<p style='margin:0 0 14px'>Thank you for your interest in <strong>“{escape(course.title)}”</strong>. "
        f"Unfortunately we couldn't verify your payment with journal number "
        f"<strong>{escape(payment.journal_number)}</strong>.</p>"
        f"<p style='margin:0 0 14px;background:#fdecea;border-radius:12px;padding:14px 18px'>"
        f"<strong>Reason:</strong> {escape(payment.failure_reason)}</p>"
        f"<p style='margin:0 0 14px'>Please check the details and submit them again. If money has already left your "
        f"account, don't worry: reply to this email with your receipt and we'll sort it out together.</p>"
        f"<p style='margin:18px 0 0'>Kind regards,<br><strong>The Lop-rig team</strong></p>",
        button=("Submit again", retry),
    )
    reply = PaymentSettings.load().alert_email
    _send(subject, [student.email], text, html, reply_to=[reply] if reply else None)


def after_commit(func, payment: Payment) -> None:
    """Send once the payment change is saved (and only if it is)."""
    transaction.on_commit(lambda: func(payment))
