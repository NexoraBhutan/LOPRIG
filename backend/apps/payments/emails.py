"""Payment emails for bank QR payments and bank-account (RMA) payments.

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
    ref_label = "Transaction ref." if payment.provider == Payment.RMA else "Journal no."
    rows = [("Course", course.title), ("Amount", _money(payment.amount)), (ref_label, payment.journal_number)]
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


# --- Bank account payments (RMA gateway) ------------------------------------------------------

def _bank_details(payment: Payment) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    """(what they enrolled in, how they paid), shared by the emails and the PDF receipt."""
    from apps.courses.models import Lesson

    course, info = payment.course, payment.raw_event or {}
    lessons = Lesson.objects.filter(module__course=course).count()
    enrollment = [
        ("Course", course.title),
        ("Category", course.category.title),
        ("Level", course.get_level_display()),
        ("Teacher", course.teacher.name),
        ("Lessons", f"{lessons} lesson{'s' if lessons != 1 else ''}"),
        ("Student", f"{payment.student.name} ({payment.student.email})"),
    ]
    paid = [
        ("Amount paid", _money(payment.amount)),
        ("Paid from", f"{info.get('bank_name', 'Bank')} account ending {info.get('account_last4', '----')}"),
        ("Purpose", info.get("purpose") or "Course fee"),
    ]
    if info.get("remarks"):
        paid.append(("Remarks", info["remarks"]))
    paid += [("Transaction ref.", payment.journal_number), ("Date", _when(payment.paid_at or payment.created_at))]
    return enrollment, paid


def _receipt_pdf(payment: Payment) -> tuple[str, bytes, str]:
    from .invoice import build_receipt_pdf

    enrollment, paid = _bank_details(payment)
    payee = PaymentSettings.load()
    account = f"A/c ending {payee.account_number[-4:]}" if payee.account_number else ""
    payee_line = " · ".join(x for x in [payee.bank_name, account] if x)
    pdf = build_receipt_pdf(
        number=f"LR-{payment.reference.removeprefix('pay_')[:10].upper()}",
        issued=_when(payment.paid_at or payment.created_at),
        student=(payment.student.name, payment.student.email),
        payee=(payee.account_name or "Lop-rig", payee_line or "Lop-rig company account"),
        items=enrollment,
        payment=paid,
        amount=_money(payment.amount),
        status="Paid. The course will be unlocked by Lop-rig shortly.",
        test_mode=bool((payment.raw_event or {}).get("test")),
        contact=[("web", settings.COMPANY_WEBSITE), ("email", settings.COMPANY_EMAIL), ("phone", settings.COMPANY_PHONE)],
        emblem=settings.LETTERHEAD_NATIONAL_EMBLEM,
    )
    return f"Lop-rig-receipt-{payment.journal_number}.pdf", pdf, "application/pdf"


def _test_note(payment: Payment) -> tuple[str, str]:
    if not (payment.raw_event or {}).get("test"):
        return "", ""
    note = "This is a test payment: the bank gateway isn't connected yet, so no money was taken."
    html = ("<p style='margin:0 0 18px;background:#fdecea;border-radius:12px;padding:12px 16px;font-size:13px;"
            "color:#a61b1b'><strong>Test payment.</strong> The bank gateway isn't connected yet, so no money was taken.</p>")
    return f"[{note}]\n\n", html


def bank_payment_received(payment: Payment) -> None:
    """To the student: warm congratulations, what they enrolled in, and the PDF receipt."""
    student, course = payment.student, payment.course
    first = student.name.split(" ")[0] or student.name
    teacher = course.teacher.name
    enrollment, paid = _bank_details(payment)
    test_text, test_html = _test_note(payment)
    courses = _site("/my-learning")
    subject = f"Payment received: congratulations on enrolling in {course.title}! 🎉"
    text = (
        test_text
        + f"Dear {first},\n\n"
        f"Congratulations, and thank you! We have received your payment of {_money(payment.amount)} for "
        f"\"{course.title}\". Our team is now unlocking the course for you. You'll receive another email "
        "the moment it's ready, usually within a day.\n\n"
        "What you've enrolled in:\n" + "".join(f"  {k}: {v}\n" for k, v in enrollment)
        + "\nYour payment:\n" + "".join(f"  {k}: {v}\n" for k, v in paid)
        + "\nYour payment receipt is attached to this email as a PDF. Please keep it for your records.\n\n"
        "Choosing to learn is one of the best gifts you can give yourself. We're truly glad to have you, "
        f"and {teacher} is looking forward to helping you grow.\n\n"
        "If you have any questions about your payment, simply reply to this email.\n\n"
        "With warm wishes,\nThe Lop-rig team"
    )
    html = _layout(
        f"We received your payment for {course.title}. Your receipt is attached.",
        test_html
        + f"<p style='margin:0 0 14px;font-size:22px;font-weight:700'>Congratulations, {escape(first)}! 🎉</p>"
        f"<p style='margin:0 0 14px'>Thank you! We have received your payment of <strong>{_money(payment.amount)}</strong> "
        f"for <strong>“{escape(course.title)}”</strong>. Our team is now unlocking the course for you. You'll receive "
        f"another email the moment it's ready, usually within a day.</p>"
        f"<p style='margin:18px 0 0;font-weight:700'>What you've enrolled in</p>{_details_table(enrollment)}"
        f"<p style='margin:0;font-weight:700'>Your payment</p>{_details_table(paid)}"
        f"<p style='margin:0 0 14px'>📎 Your <strong>payment receipt</strong> is attached to this email as a PDF. "
        f"Please keep it for your records.</p>"
        f"<p style='margin:0 0 14px'>Choosing to learn is one of the best gifts you can give yourself. We're truly glad "
        f"to have you, and <strong>{escape(teacher)}</strong> is looking forward to helping you grow. 🌱</p>"
        f"<p style='margin:0 0 4px'>If you have any questions about your payment, simply reply to this email.</p>"
        f"<p style='margin:18px 0 0'>With warm wishes,<br><strong>The Lop-rig team</strong></p>",
        button=("Go to My Learning", courses),
    )
    reply = PaymentSettings.load().alert_email
    attachments = []
    try:
        attachments.append(_receipt_pdf(payment))
    except Exception:  # a receipt problem must never stop the email
        logger.exception("Couldn't build the receipt PDF for payment %s", payment.reference)
    send(subject, [student.email], text, html, reply_to=[reply] if reply else None, attachments=attachments)


def bank_payment_alert(payment: Payment) -> None:
    """To Lop-rig: a bank payment arrived; review it and unlock the course."""
    student, course = payment.student, payment.course
    enrollment, paid = _bank_details(payment)
    test_text, test_html = _test_note(payment)
    review = _site(f"/admin/payments?review={payment.reference}")
    subject = f"Bank payment: {student.name} paid {_money(payment.amount)} for {course.title}"
    text = (
        test_text
        + f"{student.name} paid {_money(payment.amount)} from their bank account for \"{course.title}\".\n\n"
        + "".join(f"{k}: {v}\n" for k, v in enrollment + paid)
        + f"\nPlease check it and unlock the course: {review}\n"
    )
    html = _layout(
        f"{student.name} paid {_money(payment.amount)}. Unlock the course.",
        test_html
        + f"<p style='margin:0 0 14px'><strong>{escape(student.name)}</strong> paid <strong>{_money(payment.amount)}</strong> "
        f"from their bank account for <strong>“{escape(course.title)}”</strong>.</p>"
        f"{_details_table(enrollment + paid)}"
        f"<p style='margin:0'>Please check it and unlock the course. The student has been sent their receipt.</p>",
        button=("Review and unlock", review),
    )
    send(subject, _alert_recipients(), text, html, reply_to=[student.email])
