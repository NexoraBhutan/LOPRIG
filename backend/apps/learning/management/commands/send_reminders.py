"""Send the day's reminder emails (and bell notifications).

Run once a day, e.g. 9:00 am Bhutan time:
- locally: Windows Task Scheduler running `.venv/Scripts/python.exe manage.py send_reminders`
- in production: a cron job on the host (Railway "Cron Schedule": `0 3 * * *` is 9:00 BTT)

Safe to run more often: nobody gets the same reminder twice within its waiting period.
"""
from django.core.management.base import BaseCommand

from apps.learning.reminders import send_all


class Command(BaseCommand):
    help = "Email students who've paused a course, and teachers and admins with things waiting for them."

    def handle(self, *args, **options):
        sent = send_all()
        self.stdout.write(self.style.SUCCESS(
            f"Reminders sent: {sent['students']} students, {sent['teachers']} teachers, {sent['admins']} admins."
        ))
