from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models

AVATAR_COLORS = ["#ffb606", "#1a1a1a", "#c88e00", "#3a3a3a", "#ff6347"]


_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"  # no 0/O, 1/l/I


def generate_temporary_password() -> str:
    """Strong, easy-to-read password like 'Kp7x-Qm2R-hT9w-3NeZ' (16 random characters)."""
    import secrets

    while True:
        chars = "".join(secrets.choice(_PASSWORD_ALPHABET) for _ in range(16))
        if any(c.isupper() for c in chars) and any(c.islower() for c in chars) and any(c.isdigit() for c in chars):
            return "-".join(chars[i:i + 4] for i in range(0, 16, 4))


def pick_avatar_color(seed: str) -> str:
    return AVATAR_COLORS[ord(seed[0]) % len(AVATAR_COLORS)] if seed else AVATAR_COLORS[0]


class UserManager(BaseUserManager):
    """Users log in with their email address; there is no username."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("An email address is required.")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("role", User.Role.STUDENT)
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        """A site administrator: Django Admin only, never the website (see User.is_site_admin)."""
        extra.setdefault("role", User.Role.SITE_ADMIN)
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self._create_user(email, password, **extra)


class User(AbstractUser):
    """One users table for every role; the role field drives authorization.

    ADMIN runs the platform from the website's admin portal. SITE_ADMIN is a separate account
    that can only sign in to Django Admin (raw data), and is refused by the website login.
    """

    class Role(models.TextChoices):
        SITE_ADMIN = "SITEADMIN", "Site administrator"
        ADMIN = "ADMIN", "Admin"
        TEACHER = "TEACHER", "Teacher"
        STUDENT = "STUDENT", "Student"

    username = None
    first_name = None
    last_name = None

    email = models.EmailField(unique=True)
    name = models.CharField(max_length=150)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STUDENT, db_index=True)
    bio = models.TextField(blank=True, default="Lifelong learner exploring new skills on Lop-rig.")
    headline = models.CharField(max_length=150, blank=True, help_text="Shown under a teacher's name.")
    avatar_color = models.CharField(max_length=7, blank=True)
    # True while the account still uses a temporary password an admin generated.
    must_change_password = models.BooleanField(default=False)
    password_changed_at = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]

    objects = UserManager()

    class Meta:
        db_table = "users"
        ordering = ["-date_joined"]

    def __str__(self):
        return f"{self.name} <{self.email}>"

    def set_own_password(self, raw_password: str) -> None:
        """The user chose this password themselves (change password / forgot password)."""
        from django.utils import timezone

        self.set_password(raw_password)
        self.must_change_password = False
        self.password_changed_at = timezone.now()
        self.save(update_fields=["password", "must_change_password", "password_changed_at"])

    def set_temporary_password(self) -> str:
        """An admin issued a new password; the user is asked to replace it. Returns it once."""
        from django.utils import timezone

        raw = generate_temporary_password()
        self.set_password(raw)
        self.must_change_password = True
        self.password_changed_at = timezone.now()
        self.save(update_fields=["password", "must_change_password", "password_changed_at"])
        return raw

    # Django (and the admin theme) expect these; this model has one `name` field instead.
    def get_full_name(self):
        return self.name or self.email

    def get_short_name(self):
        return (self.name or self.email).split(" ")[0]

    def save(self, *args, **kwargs):
        if not self.avatar_color:
            self.avatar_color = pick_avatar_color(self.name)
        super().save(*args, **kwargs)

    @property
    def is_student(self):
        return self.role == self.Role.STUDENT

    @property
    def is_teacher(self):
        return self.role == self.Role.TEACHER

    @property
    def is_platform_admin(self):
        return self.role == self.Role.ADMIN

    @property
    def is_site_admin(self):
        """Django Admin accounts. Kept apart from website accounts so one login can't open both."""
        return self.role == self.Role.SITE_ADMIN or self.is_staff or self.is_superuser


class PasswordResetCode(models.Model):
    """A 6-digit "forgot password" code. Only a keyed hash is stored, never the code itself."""

    LIFETIME_MINUTES = 10
    MAX_ATTEMPTS = 5

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_reset_codes")
    code_hash = models.CharField(max_length=64)
    attempts = models.PositiveSmallIntegerField(default=0)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "password_reset_codes"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "used_at"])]

    def __str__(self):
        return f"Reset code for {self.user_id} ({'used' if self.used_at else 'open'})"
