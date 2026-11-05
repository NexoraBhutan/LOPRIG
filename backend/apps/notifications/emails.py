"""Lop-rig's email look and tone, shared by every email the site sends.

Each email goes out as plain text plus an HTML version (tables and inline styles, so it renders
the same in Gmail, Outlook and phone mail apps). Write warmly: greet by first name, say what
happened and what to do next, and sign off from the team.
"""
import logging
from html import escape

from django.conf import settings
from django.core.mail import EmailMultiAlternatives

logger = logging.getLogger(__name__)

GOLD = "#ffb606"
INK = "#1a1a1a"
MUTED = "#6b6b6b"
SIGN_OFF_TEXT = "Warm regards,\nThe Lop-rig team"
SIGN_OFF_HTML = "<p style='margin:24px 0 0'>Warm regards,<br><strong>The Lop-rig team</strong></p>"


def site(path: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}"


def first_name(user) -> str:
    return (user.name or "").split(" ")[0] or "there"


def p(html: str, style: str = "") -> str:
    """A paragraph. `html` must already be escaped."""
    return f"<p style='margin:0 0 14px;{style}'>{html}</p>"


def layout(preheader: str, body_html: str, button: tuple[str, str] | None = None, footer_note: str = "") -> str:
    """A simple, email-client-safe card in Lop-rig's colours."""
    cta = ""
    if button:
        label, url = button
        cta = (
            f'<p style="margin:28px 0 8px"><a href="{escape(url)}" style="background:{GOLD};color:{INK};'
            f'text-decoration:none;font-weight:700;padding:14px 26px;border-radius:999px;display:inline-block">'
            f"{escape(label)}</a></p>"
        )
    note = f"{escape(footer_note)}<br><br>" if footer_note else ""
    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#f6f5f2;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:{INK}">
<span style="display:none;max-height:0;overflow:hidden">{escape(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f2;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden">
<tr><td style="background:{INK};padding:22px 32px;font-size:20px;font-weight:700;color:#ffffff">Lop<span style="color:{GOLD}">-rig</span></td></tr>
<tr><td style="padding:32px;font-size:15px;line-height:1.65">{body_html}{cta}</td></tr>
<tr><td style="padding:18px 32px 28px;font-size:12px;line-height:1.6;color:{MUTED};border-top:1px solid #eee">
{note}Lop-rig · Learn. Grow. Build your future, made in Bhutan.</td></tr>
</table></td></tr></table></body></html>"""


def details_table(rows: list[tuple[str, str]]) -> str:
    cells = "".join(
        f'<tr><td style="padding:7px 16px 7px 0;color:{MUTED};white-space:nowrap">{escape(k)}</td>'
        f'<td style="padding:7px 0;font-weight:600;word-break:break-all">{escape(v)}</td></tr>'
        for k, v in rows
    )
    return (f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;'
            f'background:#fffaeb;border-radius:12px;padding:8px 18px;width:100%">{cells}</table>')


def code_box(code: str, caption: str) -> str:
    """A large, easy-to-copy code."""
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;width:100%">'
        f'<tr><td align="center" style="background:#fffaeb;border:2px dashed {GOLD};border-radius:14px;padding:20px">'
        f'<div style="font-size:12px;color:{MUTED};text-transform:uppercase;letter-spacing:2px;margin-bottom:6px">'
        f'{escape(caption)}</div>'
        f'<div style="font-family:Consolas,Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:8px">'
        f'{escape(code)}</div></td></tr></table>'
    )


def notice(html: str, tone: str = "info") -> str:
    """A soft coloured box for security notes ("info") or problems ("warn")."""
    bg = "#fdecea" if tone == "warn" else "#f1f5f9"
    return f"<p style='margin:20px 0 14px;background:{bg};border-radius:12px;padding:14px 18px;font-size:14px'>{html}</p>"


def send(subject: str, to: list[str], text: str, html: str, reply_to: list[str] | None = None,
         attachments: list[tuple[str, bytes, str]] | None = None, fail_silently: bool = True) -> bool:
    """Send a text + HTML email. By default a mail-server problem is logged, not raised."""
    if not to:
        logger.warning("Email %r has no recipients; skipped.", subject)
        return False
    message = EmailMultiAlternatives(subject, text, None, to, reply_to=reply_to or None)
    message.attach_alternative(html, "text/html")
    for name, content, mimetype in attachments or []:
        message.attach(name, content, mimetype)
    try:
        message.send()
    except Exception:
        if not fail_silently:
            raise
        logger.exception("Couldn't send email %r to %s", subject, to)
        return False
    return True
