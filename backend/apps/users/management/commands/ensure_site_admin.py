"""Create the site administrator from environment settings, once.

For hosts without a shell (e.g. Render's free plan), run on every start:
    python manage.py ensure_site_admin
It reads SITE_ADMIN_EMAIL and SITE_ADMIN_PASSWORD (and optional SITE_ADMIN_NAME). If either is
missing, or the account already exists, it does nothing, so an existing password is never reset.
"""
import os

from django.core.management.base import BaseCommand

from apps.users.models import User


class Command(BaseCommand):
    help = "Create the Django Admin site administrator from SITE_ADMIN_* settings if it doesn't exist."

    def handle(self, *args, **options):
        email = os.environ.get("SITE_ADMIN_EMAIL", "").strip().lower()
        password = os.environ.get("SITE_ADMIN_PASSWORD", "")
        if not email or not password:
            self.stdout.write("Site admin: SITE_ADMIN_EMAIL / SITE_ADMIN_PASSWORD not set, skipped.")
            return
        if User.objects.filter(email__iexact=email).exists():
            self.stdout.write("Site admin: account already exists, left unchanged.")
            return
        name = os.environ.get("SITE_ADMIN_NAME", "").strip() or "Site administrator"
        User.objects.create_superuser(email=email, password=password, name=name)
        self.stdout.write(self.style.SUCCESS("Site admin: account created."))
