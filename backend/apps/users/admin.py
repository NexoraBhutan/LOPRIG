from django import forms
from django.contrib import admin, messages
from django.contrib.auth.admin import GroupAdmin as BaseGroupAdmin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import Group
from django.shortcuts import redirect
from django.urls import reverse
from unfold.admin import ModelAdmin
from unfold.decorators import action, display
from unfold.forms import AdminPasswordChangeForm, UserChangeForm

from apps.authentication.services import email_login_details

from .models import User

admin.site.unregister(Group)

EMAIL_FAILED = (
    "Couldn't send the email to {email}. Check the email settings (npm run setup-email), "
    "then select the user and use “Email new login details”."
)


class CreateUserForm(forms.ModelForm):
    """No password here: the new user is emailed a temporary one and must replace it."""

    class Meta:
        model = User
        fields = ["email", "name", "role", "headline"]
        help_texts = {"email": "Their login details (with a temporary password) are emailed here."}

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("An account with this email already exists.")
        return email

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_unusable_password()
        user.is_staff = user.is_superuser = user.role == User.Role.ADMIN
        if commit:
            user.save()
        return user


@admin.register(Group)
class GroupAdmin(BaseGroupAdmin, ModelAdmin):
    pass


@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    form = UserChangeForm
    add_form = CreateUserForm
    change_password_form = AdminPasswordChangeForm

    ordering = ["-date_joined"]
    list_display = ["email", "name", "show_role", "show_password", "is_active", "date_joined"]
    list_filter = ["role", "is_active", "must_change_password", "is_staff"]
    list_filter_submit = True
    search_fields = ["email", "name"]
    actions = ["email_new_login"]
    fieldsets = (
        (None, {"fields": ("email", "must_change_password", "password_changed_at")}),
        ("Profile", {"fields": ("name", "role", "headline", "bio", "avatar_color")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "name", "role", "headline")}),
    )

    def get_readonly_fields(self, request, obj=None):
        return ["must_change_password", "password_changed_at"] if obj else []

    @display(description="Role", label={"Admin": "danger", "Teacher": "warning", "Student": "info"})
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
        for user in queryset.exclude(pk=request.user.pk):
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
