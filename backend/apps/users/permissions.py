"""Role-based permissions shared by every app.

Authentication answers "who are you?"; these classes answer "is your role allowed
to do this?". Object-level ownership (a teacher editing only their own course)
lives in IsCourseOwnerOrAdmin.
"""
from rest_framework.permissions import BasePermission

from .models import User


class HasRole(BasePermission):
    allowed_roles: tuple[str, ...] = ()

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and user.role in self.allowed_roles):
            return False
        if user.must_change_password:
            # Still on the emailed temporary password: nothing else until they set their own.
            self.message = "Set your own password first."
            return False
        return True


class IsStudent(HasRole):
    message = "Only student accounts can do this."
    allowed_roles = (User.Role.STUDENT,)


class IsTeacher(HasRole):
    message = "Only teacher accounts can do this."
    allowed_roles = (User.Role.TEACHER,)


class IsPlatformAdmin(HasRole):
    message = "Only admins can do this."
    allowed_roles = (User.Role.ADMIN,)


class IsCourseOwnerOrAdmin(BasePermission):
    """Teachers may only manage courses they own; admins may manage any course."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role == User.Role.ADMIN:
            return True
        course = getattr(obj, "course", obj)
        return user.role == User.Role.TEACHER and course.teacher_id == user.id
