"""Django settings for the Lop-rig API. All secrets come from the environment (.env)."""
from datetime import timedelta
from pathlib import Path

import environ
from django.templatetags.static import static
from django.urls import reverse_lazy

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    CORS_ALLOWED_ORIGINS=(list, ["http://localhost:3000"]),
)
# overwrite=True: when runserver reloads, the new process inherits the old environment;
# without it, edits to .env (e.g. a new email password) would be ignored until a full restart.
environ.Env.read_env(BASE_DIR / ".env", overwrite=True)

SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env("ALLOWED_HOSTS")

INSTALLED_APPS = [
    "unfold",  # admin theme; must come before django.contrib.admin
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.humanize",
    # Third party
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    # Lop-rig apps
    "apps.users",
    "apps.authentication",
    "apps.courses",
    "apps.enrollments",
    "apps.learning",
    "apps.payments",
    "apps.certificates",
    "apps.notifications",
    "apps.teaching",
    "apps.platform_admin",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {"default": env.db("DATABASE_URL")}
DATABASES["default"]["CONN_MAX_AGE"] = 60

AUTH_USER_MODEL = "users.User"
# Only Django Admin uses session login (the API uses JWT), so send staff to the admin after logging in.
LOGIN_URL = "admin:login"
LOGIN_REDIRECT_URL = "admin:index"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Thimphu"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- REST framework -------------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_FILTER_BACKENDS": ["django_filters.rest_framework.DjangoFilterBackend"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_RATES": {
        "auth": "10/min",
        "password_reset": "5/hour",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Lop-rig API",
    "DESCRIPTION": "Student-facing API for the Lop-rig learning platform.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "ENUM_NAME_OVERRIDES": {
        "EnrollmentStatusEnum": "apps.enrollments.models.Enrollment.Status",
        "PaymentStatusEnum": "apps.payments.models.Payment.Status",
        "CourseStatusEnum": "apps.courses.models.Course.Status",
        "LessonKindEnum": "apps.courses.models.Lesson.Kind",
        "NotificationKindEnum": "apps.notifications.models.Notification.Kind",
    },
}

CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")

# --- Email, frontend, payments --------------------------------------------

EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="Lop-rig <no-reply@loprig.bt>")
# Used only when EMAIL_BACKEND is the SMTP backend (see .env.example).
EMAIL_HOST = env("EMAIL_HOST", default="smtp.gmail.com")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_TIMEOUT = 15
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:3000")

# Off: every published course is free to enroll (prices stay saved for later).
PAYMENTS_ENABLED = env.bool("PAYMENTS_ENABLED", default=True)
# "qr": students pay with Lop-rig's bank QR code and submit the journal number + screenshot for an
# admin to verify. "mock" is only for automated tests of the gateway code path.
PAYMENT_PROVIDER = env("PAYMENT_PROVIDER", default="qr")
PAYMENT_PROOF_MAX_MB = 5
PAYMENT_WEBHOOK_SECRET = env("PAYMENT_WEBHOOK_SECRET")

# Video hosting: Bunny Stream (https://bunny.net/stream). Leave the library ID empty to turn
# uploads off; teachers can still paste a YouTube/Vimeo link.
#   LIBRARY_ID / API_KEY: Stream library > API.
#   TOKEN_KEY: Stream library > Security > "Token authentication key" (turn on embed token
#     authentication there so only signed-in, enrolled students can play videos).
#   READONLY_API_KEY: verifies the webhook signature (Stream library > API > Read-only key).
BUNNY_STREAM_LIBRARY_ID = env("BUNNY_STREAM_LIBRARY_ID", default="")
BUNNY_STREAM_API_KEY = env("BUNNY_STREAM_API_KEY", default="")
BUNNY_STREAM_TOKEN_KEY = env("BUNNY_STREAM_TOKEN_KEY", default="")
BUNNY_STREAM_READONLY_API_KEY = env("BUNNY_STREAM_READONLY_API_KEY", default="")
VIDEO_PLAYBACK_TTL_SECONDS = env.int("VIDEO_PLAYBACK_TTL_SECONDS", default=4 * 60 * 60)
VIDEO_MAX_UPLOAD_MB = env.int("VIDEO_MAX_UPLOAD_MB", default=2048)
PAYMENT_CURRENCY = "BTN"

# --- Admin theme (django-unfold) ------------------------------------------


def _nav(title, icon, model, badge=None):
    item = {"title": title, "icon": icon, "link": reverse_lazy(f"admin:{model}_changelist")}
    if badge:
        item["badge"] = badge
    return item


UNFOLD = {
    "SITE_TITLE": "Lop-rig admin",
    "SITE_HEADER": "Lop-rig",
    "SITE_SUBHEADER": "Platform administration",
    "SITE_URL": FRONTEND_URL,
    # Same artwork as the Next.js site: navy-and-teal on the light theme, all-white on the dark theme.
    "SITE_LOGO": {
        "light": lambda request: static("admin/loprig-logo-color.png"),
        "dark": lambda request: static("admin/loprig-logo-white.png"),
    },
    "SITE_FAVICONS": [{"rel": "icon", "type": "image/png", "href": lambda request: static("admin/loprig-icon.png")}],
    "SHOW_VIEW_ON_SITE": False,
    "SHOW_HISTORY": True,
    "DASHBOARD_CALLBACK": "apps.users.dashboard.dashboard_callback",
    "STYLES": [lambda request: static("admin/loprig.css")],
    "COLORS": {
        # Lop-rig gold. 600/700 are darkened so white button text stays readable (WCAG AA).
        "primary": {
            "50": "#fffaeb",
            "100": "#fff6e0",
            "200": "#ffe7a8",
            "300": "#ffd266",
            "400": "#ffb606",
            "500": "#c88e00",
            "600": "#9a6b00",
            "700": "#7d5700",
            "800": "#5e4100",
            "900": "#3f2c00",
            "950": "#241900",
        },
    },
    "SIDEBAR": {
        "show_search": True,
        "show_all_applications": False,
        "navigation": [
            {
                "title": "Overview",
                "items": [{"title": "Dashboard", "icon": "space_dashboard", "link": reverse_lazy("admin:index")}],
            },
            {
                "title": "Catalogue",
                "items": [
                    _nav("Courses", "menu_book", "courses_course", badge="apps.users.dashboard.pending_courses_badge"),
                    _nav("Categories", "category", "courses_category"),
                    _nav("Modules", "view_list", "courses_coursemodule"),
                    _nav("Lessons", "play_lesson", "courses_lesson"),
                ],
            },
            {
                "title": "People",
                "items": [_nav("Users", "group", "users_user")],
            },
            {
                "title": "Learning",
                "items": [
                    _nav("Enrollments", "how_to_reg", "enrollments_enrollment"),
                    _nav("Lesson progress", "trending_up", "learning_lessonprogress"),
                    _nav("Certificates", "workspace_premium", "certificates_certificate"),
                ],
            },
            {
                "title": "Money & messages",
                "items": [
                    _nav("Payments", "payments", "payments_payment"),
                    _nav("Notifications", "notifications", "notifications_notification"),
                ],
            },
        ],
    },
}

# --- Production hardening -------------------------------------------------

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
