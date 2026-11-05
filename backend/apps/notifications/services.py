from html import escape

from .emails import SIGN_OFF_HTML, SIGN_OFF_TEXT, first_name, layout, p, send
from .models import Notification


def notify(
    user,
    kind: str,
    title: str,
    message: str = "",
    data: dict | None = None,
    email: bool = False,
    email_body: list[str] | None = None,
    email_button: tuple[str, str] | None = None,
) -> Notification:
    """Store an in-app notification and optionally email it.

    `email_body` is the email's paragraphs (plain text; the greeting and sign-off are added here).
    Without it, the in-app message is used. Email is sent inline for now; move it to a Celery task
    once Celery + Redis are added, so a slow mail server never slows down the request.
    """
    notification = Notification.objects.create(user=user, kind=kind, title=title, message=message, data=data or {})
    if email:
        paragraphs = email_body or [message]
        name = first_name(user)
        text = f"Hello {name},\n\n" + "\n\n".join(paragraphs)
        if email_button:
            text += f"\n\n{email_button[0]}: {email_button[1]}"
        text += f"\n\n{SIGN_OFF_TEXT}"
        html = layout(
            paragraphs[0],
            p(f"Hello {escape(name)},", "font-size:18px;font-weight:700")
            + "".join(p(escape(para)) for para in paragraphs)
            + SIGN_OFF_HTML,
            button=email_button,
        )
        # A failed email must never undo an enrollment or payment; send() logs it instead.
        send(title, [user.email], text, html)
    return notification
