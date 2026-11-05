"""Account emails: password reset code, password changed, and login details from an admin."""
from html import escape

from django.utils import timezone

from apps.notifications.emails import (
    SIGN_OFF_HTML,
    SIGN_OFF_TEXT,
    code_box,
    details_table,
    first_name,
    layout,
    notice,
    p,
    send,
    site,
)

SECURITY_NOTE = "Lop-rig will never ask for your password or codes by phone, message or email."

ROLE_WELCOME = {
    "TEACHER": "We're so glad to have you with us as a teacher. Thank you for choosing to share your "
               "knowledge with learners across Bhutan.",
    "ADMIN": "You've been given an administrator account to help look after Lop-rig. Thank you for "
             "helping keep things running smoothly for our learners and teachers.",
    "STUDENT": "We're delighted to welcome you as a learner. Your learning journey starts here.",
}


def _now() -> str:
    return timezone.localtime().strftime("%d %b %Y, %I:%M %p")


def password_reset_code(user, code: str, minutes: int) -> None:
    """Raises if the mail server is down, so the person isn't told a code is on its way when it isn't."""
    name = first_name(user)
    subject = f"{code} is your Lop-rig reset code"
    text = (
        f"Hello {name},\n\n"
        "We received a request to reset the password for your Lop-rig account. "
        "No worries, it happens to all of us!\n\n"
        f"Your password reset code is: {code}\n\n"
        f"Please enter this code on the reset page within {minutes} minutes. "
        "For your security, it can only be used once.\n\n"
        "Didn't ask for this? You can safely ignore this email. Your password will stay the same "
        "and your account remains secure.\n\n"
        f"Please keep this code to yourself. {SECURITY_NOTE}\n\n"
        f"{SIGN_OFF_TEXT}"
    )
    html = layout(
        f"Your reset code is {code}. It's valid for {minutes} minutes.",
        p(f"Hello {escape(name)},", "font-size:18px;font-weight:700")
        + p("We received a request to reset the password for your Lop-rig account. "
            "No worries, it happens to all of us!")
        + code_box(code, "Your reset code")
        + p(f"Please enter this code on the reset page within <strong>{minutes} minutes</strong>. "
            "For your security, it can only be used once.")
        + notice("<strong>Didn't ask for this?</strong> You can safely ignore this email. Your password "
                 "will stay the same and your account remains secure.")
        + p(f"Please keep this code to yourself. {escape(SECURITY_NOTE)}", "font-size:13px;color:#6b6b6b")
        + SIGN_OFF_HTML,
        footer_note=f"You're receiving this because a password reset was requested for {user.email}.",
    )
    send(subject, [user.email], text, html, fail_silently=False)


def password_changed(user) -> None:
    """Confirms a successful reset, so the owner notices if it wasn't them."""
    name = first_name(user)
    when = _now()
    login = site("/login")
    help_url = site("/forgot-password")
    subject = "Your Lop-rig password has been changed"
    text = (
        f"Hello {name},\n\n"
        f"This is a quick note to confirm that the password for your Lop-rig account ({user.email}) "
        f"was changed on {when}.\n\n"
        "For your safety, we've signed you out on all your devices. You can log in again with "
        f"your new password here: {login}\n\n"
        "If you made this change, there's nothing else you need to do. Thank you for keeping your "
        "account secure!\n\n"
        "If this wasn't you, please reset your password straight away at "
        f"{help_url} and reply to this email so we can help.\n\n"
        f"{SIGN_OFF_TEXT}"
    )
    html = layout(
        "Your password was changed successfully.",
        p(f"Hello {escape(name)},", "font-size:18px;font-weight:700")
        + p("This is a quick note to confirm that the password for your Lop-rig account was changed.")
        + details_table([("Account", user.email), ("Changed on", when)])
        + p("For your safety, we've signed you out on all your devices. You can log in again with your "
            "new password whenever you're ready.")
        + p("If you made this change, there's nothing else you need to do. Thank you for keeping your "
            "account secure! 🔒")
        + notice(f"<strong>Wasn't you?</strong> Please <a href='{escape(help_url)}' style='color:#1a1a1a'>"
                 "reset your password</a> straight away and reply to this email so we can help.", "warn")
        + SIGN_OFF_HTML,
        button=("Log in to Lop-rig", login),
    )
    send(subject, [user.email], text, html)


def login_details(user, password: str, *, reset: bool) -> None:
    """Raises if the mail server is down; the caller reports that to the admin."""
    name = first_name(user)
    sent_at = _now()
    login = site("/login")
    role = user.get_role_display().lower()
    # The time keeps Gmail from threading several emails together, so the newest is easy to find.
    if reset:
        subject = f"Your new Lop-rig login details ({sent_at})"
        intro = ("An administrator has reset the password for your Lop-rig account, as requested. "
                 "Your previous password no longer works, and here are your new login details.")
        preheader = "Your password has been reset. Here are your new login details."
        greeting = f"Hello, {name}!"
    else:
        subject = f"Welcome to Lop-rig, {name}! Your login details ({sent_at})"
        intro = f"An account has been created for you on Lop-rig. {ROLE_WELCOME.get(user.role, ROLE_WELCOME['STUDENT'])}"
        preheader = f"Welcome to Lop-rig! Your {role} account is ready."
        greeting = f"Welcome, {name}! 🎉"
    steps = [
        "Log in with your email and the temporary password above.",
        "Choose a new password of your own when asked. It only takes a moment.",
        "That's it, you're all set!",
    ]
    text = (
        f"Hello {name},\n\n"
        f"{intro}\n\n"
        f"Log in at: {login}\n"
        f"Email: {user.email}\n"
        f"Temporary password: {password}\n\n"
        "Getting started:\n"
        + "".join(f"  {i}. {s}\n" for i, s in enumerate(steps, 1))
        + "\nPlease type or paste the password exactly, without spaces before or after it. "
        f"Sent {sent_at}: this replaces any earlier Lop-rig login email, so only this newest password works.\n\n"
        f"For your security, please don't share your password with anyone. {SECURITY_NOTE}\n\n"
        "If you have any questions, simply reply to this email and we'll be happy to help.\n\n"
        f"{SIGN_OFF_TEXT}"
    )
    steps_html = "".join(f"<li style='margin:0 0 6px'>{escape(s)}</li>" for s in steps)
    html = layout(
        preheader,
        p(escape(greeting), "font-size:20px;font-weight:700")
        + p(escape(intro))
        + details_table([("Email", user.email), ("Temporary password", password)])
        + p("<strong>Getting started</strong>", "margin-bottom:6px")
        + f"<ol style='margin:0 0 14px;padding-left:20px'>{steps_html}</ol>"
        + notice("Please type or paste the password exactly, without spaces before or after it. "
                 f"This email was sent on {escape(sent_at)} and replaces any earlier login email, so only "
                 "this newest password works.")
        + p(f"For your security, please don't share your password with anyone. {escape(SECURITY_NOTE)}",
            "font-size:13px;color:#6b6b6b")
        + p("If you have any questions, simply reply to this email and we'll be happy to help.")
        + SIGN_OFF_HTML,
        button=("Log in to Lop-rig", login),
    )
    send(subject, [user.email], text, html, fail_silently=False)
