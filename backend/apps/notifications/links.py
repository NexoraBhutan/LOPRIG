"""Where a notification takes its reader on the website (a path, e.g. "/learn/python-101").

Worked out from the notification's kind, its data and who it is for, so older notifications
(created before links existed) open the right page too. A notification can also set
data["link"] explicitly.
"""
from .models import Notification


def link_for(n: Notification) -> str:
    data = n.data or {}
    if data.get("link"):
        return data["link"]
    role = getattr(n.user, "role", "")
    course = data.get("course")
    Kind = Notification.Kind

    if data.get("review"):
        return f"/teach/reviews/{data['review']}"
    if data.get("certificate"):
        return f"/certificates/{data['certificate']}"
    if data.get("quiz") and course:
        return f"/learn/{course}?quiz={data['quiz']}"
    if n.kind in (Kind.COMMENT, Kind.REMINDER) and course:
        lesson = data.get("lesson")
        return f"/learn/{course}?lesson={lesson}" if lesson else f"/learn/{course}"

    if role == "ADMIN":
        if n.kind == Kind.PAYMENT:
            return "/admin/payments"
        return f"/admin/courses/{course}" if course else "/admin"
    if role == "TEACHER":
        if n.kind == Kind.ENROLLMENT and course:
            return f"/teach/courses/{course}?tab=students"
        return f"/teach/courses/{course}" if course else "/teach"

    # Students
    if n.kind == Kind.PAYMENT:
        return "/my-learning"
    return f"/learn/{course}" if course else "/my-learning"
