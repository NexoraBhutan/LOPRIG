from django import forms
from django.contrib import admin, messages
from django.contrib.auth.admin import GroupAdmin as BaseGroupAdmin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.models import Group
from django.db.models import Q
from django.shortcuts import redirect
from django.utils.html import format_html
from django.urls import reverse
from unfold.admin import ModelAdmin
from unfold.decorators import action, display
from unfold.forms import AdminPasswordChangeForm, UserChangeForm
from unfold.forms import AuthenticationForm as UnfoldAuthenticationForm

from apps.authentication.services import email_login_details

from .models import User

admin.site.unregister(Group)


class AdminLoginForm(UnfoldAuthenticationForm):
    """Django Admin login for site administrators and the website's admins (same email + password)."""

    def confirm_login_allowed(self, user):
        AuthenticationForm.confirm_login_allowed(self, user)  # active account
        if not user.can_use_django_admin:
            raise forms.ValidationError(self.error_messages["invalid_login"], code="invalid_login",
                                        params={"username": self.username_field.verbose_name})
        if user.must_change_password:
            raise forms.ValidationError("Set your own password on the website first, then sign in here.",
                                        code="must_change_password")


admin.site.login_form = AdminLoginForm
# Django's default only lets staff in; the website's admins are not staff (see User.has_perm).
admin.site.has_permission = lambda request: bool(
    request.user.is_authenticated and request.user.can_use_django_admin
    and not request.user.must_change_password
)

EMAIL_FAILED = (
    "Couldn't send the email to {email}. Check the email settings (npm run setup-email), "
    "then select the user and use “Email new login details”."
)


def is_site_admin_q() -> Q:
    """Database version of User.is_site_admin."""
    return Q(role=User.Role.SITE_ADMIN) | Q(is_staff=True) | Q(is_superuser=True)


class CreateUserForm(forms.ModelForm):
    """No password here: the new user is emailed a temporary one and must replace it."""

    class Meta:
        model = User
        fields = ["email", "name", "role", "headline"]
        help_texts = {"email": "Their login details (with a temporary password) are emailed here."}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Website accounts only. Site administrators are made with `manage.py createsuperuser`.
        self.fields["role"].choices = [c for c in User.Role.choices if c[0] != User.Role.SITE_ADMIN]

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("An account with this email already exists.")
        return email

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_unusable_password()
        user.is_staff = user.is_superuser = False  # website accounts never open Django Admin
        if commit:
            user.save()
        return user


@admin.register(Group)
class GroupAdmin(BaseGroupAdmin, ModelAdmin):
    pass


def _avatar(user, size: int):
    """The user's photo as a circle, or their initial on their colour (as on the website)."""
    style = f"width:{size}px;height:{size}px;border-radius:9999px;object-fit:cover;display:inline-flex;"             f"align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:{size * 0.42:.0f}px"
    if user.avatar_url:
        return format_html('<img src="{}" alt="" referrerpolicy="no-referrer" style="{}">', user.avatar_url, style)
    return format_html('<span style="{};background:{}">{}</span>', style, user.avatar_color or "#1a1a1a",
                       (user.name or user.email)[:1].upper())


@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    form = UserChangeForm
    add_form = CreateUserForm
    change_password_form = AdminPasswordChangeForm

    ordering = ["-date_joined"]
    list_display = ["show_photo", "email", "name", "show_role", "show_password", "is_active", "date_joined"]
    list_display_links = ["show_photo", "email"]
    list_filter = ["role", "is_active", "must_change_password", "is_staff"]
    list_filter_submit = True
    search_fields = ["email", "name"]
    actions = ["email_new_login"]
    fieldsets = (
        (None, {"fields": ("email", "must_change_password", "password_changed_at")}),
        ("Profile", {"fields": ("name", "role", "headline", "bio", "photo_preview", "avatar", "google_picture",
                                "avatar_color")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "name", "role", "headline")}),
    )

    def get_readonly_fields(self, request, obj=None):
        return ["must_change_password", "password_changed_at", "photo_preview", "google_picture"] if obj else []

    @display(description="Photo")
    def show_photo(self, obj):
        return _avatar(obj, 36)

    @display(description="Photo preview")
    def photo_preview(self, obj):
        hint = "Uploaded photo." if obj.avatar else "From their Google account." if obj.google_picture             else "No photo: their initial on their colour is shown."
        return format_html("{}<p style=\"margin-top:.5em;color:#6b7280\">{}</p>", _avatar(obj, 120), hint)

    @display(description="Role", label={"Site administrator": "danger", "Admin": "primary",
                                        "Teacher": "warning", "Student": "info"})
    def show_role(self, obj):
        return obj.get_role_display()

    @display(description="Password", label={"Temporary": "warning", "Own password": "success"})
    def show_password(self, obj):
        return "Temporary" if obj.must_change_password else "Own password"

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if change:
            return
        if email_login_details(obj):
            messages.success(request, f"Login details emailed to {obj.email}. "
                                      "They'll set their own password after logging in.")
        else:
            messages.error(request, EMAIL_FAILED.format(email=obj.email))

    @action(description="Email new login details (resets their password)")
    def email_new_login(self, request, queryset):
        sent, failed = [], []
        # The email points at the website login, which site administrators can't use.
        site_admins = queryset.filter(is_site_admin_q())
        if site_admins.exists():
            messages.warning(request, "Skipped site administrators: they reset with "
                                      "“manage.py changepassword <email>”.")
        for user in queryset.exclude(pk=request.user.pk).exclude(is_site_admin_q()):
            (sent if email_login_details(user, reset=True) else failed).append(user.email)
        if sent:
            messages.success(request, f"New login details emailed to {', '.join(sent)}.")
        for email in failed:
            messages.error(request, EMAIL_FAILED.format(email=email))
        if not sent and not failed:
            messages.warning(request, "Nothing sent. Change your own password from your account instead.")

    def user_change_password(self, request, id, form_url=""):
        # Users set their own passwords; admins can only email new login details.
        if str(id) != str(request.user.pk):
            messages.info(request, "Passwords are private to each user. To help someone who is locked out, "
                                   "select them in the list and use “Email new login details”.")
            return redirect(reverse("admin:users_user_change", args=[id]))
        return super().user_change_password(request, id, form_url)
