"""Load the demo catalogue the Next.js app used to ship as static data.

    python manage.py seed_demo [--with-demo-student]

Safe to run repeatedly: categories, teachers and course details are updated in place,
and a course's curriculum is only created the first time (so student progress is never wiped).
"""
import json
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from apps.courses.models import Category, Course, CourseModule, Lesson
from apps.users.models import User

FIXTURE = Path(__file__).resolve().parents[2] / "fixtures" / "demo_catalog.json"
DEMO_STUDENT = {"email": "demo@loprig.app", "password": "password123", "name": "Demo Learner"}
DEMO_TEACHER = {"email": "tenzin.wangchuk@teachers.loprig.bt", "password": "password123"}


def clock_to_seconds(value: str) -> int:
    minutes, seconds = value.split(":")
    return int(minutes) * 60 + int(seconds)


class Command(BaseCommand):
    help = "Seed categories, teachers and published demo courses."

    def add_arguments(self, parser):
        parser.add_argument(
            "--with-demo-student",
            action="store_true",
            help=f"Also create the {DEMO_STUDENT['email']} student used by the login page's demo button.",
        )
        parser.add_argument(
            "--with-demo-teacher",
            action="store_true",
            help=f"Give the seeded teacher {DEMO_TEACHER['email']} a password so the teacher portal can be tried.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        data = json.loads(FIXTURE.read_text(encoding="utf-8"))

        for order, cat in enumerate(data["categories"]):
            Category.objects.update_or_create(
                slug=cat["id"], defaults={"title": cat["title"], "icon": cat["icon"], "order": order}
            )

        now = timezone.now()
        created_courses = 0
        for index, item in enumerate(data["courses"]):
            teacher = self._teacher(item["instructor"])
            price = Decimal(str(item["price"]))
            discount = Decimal(str(item["discountPrice"]))
            course, created = Course.objects.update_or_create(
                slug=item["id"],
                defaults={
                    "title": item["title"],
                    "description": item["description"],
                    "category": Category.objects.get(slug=item["category"]),
                    "teacher": teacher,
                    "level": item["level"],
                    "language": item["language"],
                    "price": price,
                    "discount_price": discount if discount < price else None,
                    "rating": Decimal(str(item["rating"])),
                    "bestseller": item["bestseller"],
                    "gradient_start": item["gradient"][0],
                    "gradient_end": item["gradient"][1],
                    "requirements": item["requirements"],
                    "what_you_learn": item["whatYouLearn"],
                },
            )
            if created:
                course.students_count = item["students"]
                course.publish()
                course.published_at = now - timedelta(days=index)
                course.save()
                self._curriculum(course, item["curriculum"])
                created_courses += 1

        self.stdout.write(self.style.SUCCESS(
            f"Seeded {len(data['categories'])} categories and {len(data['courses'])} courses "
            f"({created_courses} new)."
        ))

        if options["with_demo_student"]:
            self._demo_student()
        if options["with_demo_teacher"]:
            teacher = User.objects.get(email=DEMO_TEACHER["email"])
            if teacher.has_usable_password():
                self.stdout.write(f"Demo teacher {DEMO_TEACHER['email']} already has a password.")
            else:
                teacher.set_password(DEMO_TEACHER["password"])
                teacher.save(update_fields=["password"])
                self.stdout.write(self.style.SUCCESS(
                    f"Demo teacher: {DEMO_TEACHER['email']} / {DEMO_TEACHER['password']}"
                ))

    def _teacher(self, instructor: dict) -> User:
        email = f"{slugify(instructor['name']).replace('-', '.')}@teachers.loprig.bt"
        teacher, created = User.objects.get_or_create(
            email=email,
            defaults={"name": instructor["name"], "headline": instructor["title"], "role": User.Role.TEACHER},
        )
        if created:
            teacher.set_unusable_password()  # Admin sets up a real login when the teacher portal ships.
            teacher.save(update_fields=["password"])
        return teacher

    def _curriculum(self, course: Course, sections: list[dict]) -> None:
        for m_order, section in enumerate(sections):
            module = CourseModule.objects.create(course=course, title=section["title"], order=m_order)
            for l_order, lesson in enumerate(section["lessons"]):
                Lesson.objects.create(
                    module=module,
                    title=lesson["title"],
                    order=l_order,
                    kind=Lesson.Kind.VIDEO,
                    duration_seconds=clock_to_seconds(lesson["duration"]),
                    is_preview=(m_order == 0 and l_order == 0),
                    body=f"Notes for “{lesson['title']}” will appear here.",
                )

    def _demo_student(self) -> None:
        student, created = User.objects.get_or_create(
            email=DEMO_STUDENT["email"], defaults={"name": DEMO_STUDENT["name"], "role": User.Role.STUDENT}
        )
        if created:
            student.set_password(DEMO_STUDENT["password"])
            student.save(update_fields=["password"])
            self.stdout.write(self.style.SUCCESS(f"Created demo student {DEMO_STUDENT['email']}."))
        else:
            self.stdout.write(f"Demo student {DEMO_STUDENT['email']} already exists.")
