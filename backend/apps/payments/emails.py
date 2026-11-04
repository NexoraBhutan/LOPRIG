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

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.utils import timezone

from apps.users.models import User

from .models import Payment, PaymentSettings

logger = logging.getLogger(__name__)

GOLD = "#ffb606"
INK = "#1a1a1a"
MUTED = "#6b6b6b"


def _site(path: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}"


def _money(amount) -> str:
    return f"Nu. {amount:,.0f}"


def _when(dt) -> str:
    return timezone.localtime(dt).strftime("%d %b %Y, %I:%M %p")


def _layout(preheader: str, body_html: str, button: tuple[str, str] | None = None) -> str:
    """A simple, email-client-safe card (tables + inline styles), in Lop-rig's colours."""
    cta = ""
    if button:
        label, url = button
        cta = (
            f'<p style="margin:28px 0 8px"><a href="{escape(url)}" style="background:{GOLD};color:{INK};'
            f'text-decoration:none;font-weight:700;padding:14px 26px;border-radius:999px;display:inline-block">'
            f"{escape(label)}</a></p>"
        )
    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#f6f5f2;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:{INK}">
<span style="display:none;max-height:0;overflow:hidden">{escape(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f2;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden">
<tr><td style="background:{INK};padding:22px 32px;font-size:20px;font-weight:700;color:#ffffff">Lop<span style="color:{GOLD}">-rig</span></td></tr>
<tr><td style="padding:32px;font-size:15px;line-height:1.65">{body_html}{cta}</td></tr>
<tr><td style="padding:18px 32px 28px;font-size:12px;color:{MUTED};border-top:1px solid #eee">
Lop-rig · Learn. Grow. Build your future, made in Bhutan.</td></tr>
</table></td></tr></table></body></html>"""


def _details_table(rows: list[tuple[str, str]]) -> str:
    cells = "".join(
        f'<tr><td style="padding:7px 16px 7px 0;color:{MUTED};white-space:nowrap">{escape(k)}</td>'
        f'<td style="padding:7px 0;font-weight:600">{escape(v)}</td></tr>'
        for k, v in rows
    )
    return (f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;'
            f'background:#fffaeb;border-radius:12px;padding:8px 18px;width:100%">{cells}</table>')


def _send(subject: str, to: list[str], text: str, html: str, reply_to: list[str] | None = None,
          attach_proof: Payment | None = None) -> None:
    if not to:
        logger.warning("Payment email %r has no recipients; skipped.", subject)
        return
    message = EmailMultiAlternatives(subject, text, None, to, reply_to=reply_to or None)
    message.attach_alternative(html, "text/html")
    if attach_proof and attach_proof.proof:
        try:
            with attach_proof.proof.open("rb") as f:
                content = f.read()
            name = f"payment-{attach_proof.journal_number or attach_proof.reference}"
            ext = attach_proof.proof.name.rsplit(".", 1)[-1]
            message.attach(f"{name}.{ext}", content, mimetypes.guess_type(f"x.{ext}")[0] or "image/png")
        except OSError:
            logger.warning("Couldn't attach the screenshot for payment %s", attach_proof.reference)
    try:
        message.send()
    except Exception:  # SMTP down, bad password, ...: log it, never break the payment
        logger.exception("Couldn't send payment email %r to %s", subject, to)


def _alert_recipients() -> list[str]:
    owner = PaymentSettings.load().alert_email
    if owner:
        return [owner]
    return list(User.objects.filter(role=User.Role.ADMIN, is_active=True).values_list("email", flat=True))


# --- 1. To the account holder: "I've paid" ---------------------------------------------------

def payment_submitted(payment: Payment) -> None:
    student, course = payment.student, payment.course
    review = _site("/admin/payments")
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
