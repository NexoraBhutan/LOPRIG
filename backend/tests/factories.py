"""Small helpers to build test data without fixtures."""
from decimal import Decimal

from apps.courses.models import Category, Course, CourseModule, Lesson
from apps.users.models import User

PASSWORD = "Str0ng-Passw0rd!"


def make_user(email="student@example.com", role=User.Role.STUDENT, name="Test Student", password=PASSWORD):
    return User.objects.create_user(email=email, password=password, name=name, role=role)


def make_teacher(email="teacher@example.com"):
    return make_user(email=email, role=User.Role.TEACHER, name="Test Teacher")


def make_category(slug="programming", title="Programming"):
    return Category.objects.get_or_create(slug=slug, defaults={"title": title, "icon": "Code"})[0]


def make_course(
    slug="python-101",
    price="0",
    discount=None,
    status=Course.Status.PUBLISHED,
    lessons=3,
    category=None,
    teacher=None,
    title=None,
    level=Course.Level.BEGINNER,
    rating="4.5",
):
    course = Course(
        slug=slug,
        title=title or slug.replace("-", " ").title(),
        description=f"About {slug}",
        category=category or make_category(),
        teacher=teacher or User.objects.filter(role=User.Role.TEACHER).first() or make_teacher(),
        price=Decimal(price),
        discount_price=Decimal(discount) if discount is not None else None,
        level=level,
        rating=Decimal(rating),
        status=status,
    )
    if status == Course.Status.PUBLISHED:
        course.publish()
    course.save()
    module = CourseModule.objects.create(course=course, title="Module 1", order=0)
    for i in range(lessons):
        Lesson.objects.create(
            module=module,
            title=f"Lesson {i + 1}",
            order=i,
            duration_seconds=300,
            is_preview=(i == 0),
            video_url=f"https://videos.example.com/{slug}/{i + 1}",
            body="Secret lesson notes",
        )
    return course


def lessons_of(course):
    return list(Lesson.objects.filter(module__course=course).order_by("module__order", "order"))
