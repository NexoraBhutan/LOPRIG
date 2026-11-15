import re
from unittest import mock

from django.core import mail
from django.test import TestCase

from apps.courses.models import Course
from apps.users.models import User

from .factories import PASSWORD, make_course, make_teacher

ADD_URL = "/admin/users/user/add/"
LIST_URL = "/admin/users/user/"


def emailed_password():
    return re.search(r"Temporary password: (\S+)", mail.outbox[-1].body).group(1)


class DjangoAdminUserTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(email="boss@example.com", password="Adm1n-pass-123", name="Boss")
        self.client.force_login(self.admin)

    def test_add_form_has_no_password_and_emails_the_teacher(self):
        page = self.client.get(ADD_URL).content.decode()
        self.assertNotIn('name="password1"', page)

        res = self.client.post(ADD_URL, {"email": "Dorji@Teachers.bt", "name": "Dorji Wangmo", "role": "TEACHER"}, follow=True)
        user = User.objects.get(email="dorji@teachers.bt")
        self.assertTrue(user.must_change_password)
        self.assertFalse(user.is_staff)
        self.assertEqual(mail.outbox[-1].to, ["dorji@teachers.bt"])
        password = emailed_password()
        self.assertTrue(user.check_password(password))
        self.assertIn("Login details emailed to dorji@teachers.bt", res.content.decode())
        self.assertNotIn(password, res.content.decode())  # the admin never sees it

        login = self.client.post("/api/v1/auth/login/", {"email": "dorji@teachers.bt", "password": password},
                                 content_type="application/json")
        self.assertEqual(login.status_code, 200)

    def test_email_failure_is_reported(self):
        with mock.patch("django.core.mail.EmailMultiAlternatives.send", side_effect=OSError("no network")):
            res = self.client.post(ADD_URL, {"email": "a@b.bt", "name": "A", "role": "TEACHER"}, follow=True)
        self.assertTrue(User.objects.filter(email="a@b.bt").exists())
        self.assertIn("Couldn&#x27;t send the email", res.content.decode())

    def test_email_new_login_action(self):
        teacher = make_teacher()
        res = self.client.post(LIST_URL, {"action": "email_new_login", "_selected_action": [teacher.pk]}, follow=True)
        teacher.refresh_from_db()
        self.assertTrue(teacher.must_change_password)
        self.assertFalse(teacher.check_password(PASSWORD))
        self.assertTrue(teacher.check_password(emailed_password()))
        self.assertIn("New login details emailed to teacher@example.com", res.content.decode())

    def test_lessons_page_course_cards_approve_and_reject(self):
        teacher = make_teacher()
        pending = make_course("waiting", teacher=teacher, status=Course.Status.PENDING_REVIEW)
        other = make_course("second", teacher=teacher, status=Course.Status.PENDING_REVIEW)
        page = self.client.get("/admin/courses/lesson/").content.decode()
        self.assertIn("Courses awaiting your review", page)
        self.assertEqual(page.count('<article class="lr-course-card'), 2)
        self.assertIn(f"/admin/courses/lesson/review/{pending.pk}/approve/", page)

        back = f"/admin/courses/lesson/?module__course__teacher__id__exact={teacher.pk}"
        self.assertEqual(self.client.get(f"/admin/courses/lesson/review/{pending.pk}/approve/").status_code, 405)
        res = self.client.post(f"/admin/courses/lesson/review/{pending.pk}/approve/", {"next": back})
        self.assertRedirects(res, back, fetch_redirect_response=False)
        pending.refresh_from_db()
        self.assertEqual(pending.status, Course.Status.PUBLISHED)

        self.client.post(f"/admin/courses/lesson/review/{other.pk}/reject/", {"note": "short"})
        other.refresh_from_db()
        self.assertEqual(other.status, Course.Status.PENDING_REVIEW)  # note too short
        self.client.post(f"/admin/courses/lesson/review/{other.pk}/reject/",
                         {"note": "Please add captions to every video.", "next": "https://evil.example/"})
        other.refresh_from_db()
        self.assertEqual(other.status, Course.Status.REJECTED)
        self.assertEqual(other.review_note, "Please add captions to every video.")

        self.client.force_login(teacher)  # not an admin
        self.assertNotEqual(self.client.post(f"/admin/courses/lesson/review/{other.pk}/approve/").status_code, 200)
        other.refresh_from_db()
        self.assertEqual(other.status, Course.Status.REJECTED)

    def test_admin_cannot_set_someone_elses_password(self):
        teacher = make_teacher()
        res = self.client.post(f"{LIST_URL}{teacher.pk}/password/",
                               {"password1": "Hacked-pass-123", "password2": "Hacked-pass-123"})
        self.assertEqual(res.status_code, 302)
        teacher.refresh_from_db()
        self.assertTrue(teacher.check_password(PASSWORD))


class WebsiteAdminInDjangoAdminTests(TestCase):
    """The website's admins can use Django Admin fully, with the same email and password,
    and still use the website. Teachers and students can't get in."""

    def setUp(self):
        self.admin = User.objects.create_user(email="admin@loprig.bt", password=PASSWORD, name="Pema",
                                              role=User.Role.ADMIN)

    def login(self, email):
        return self.client.post("/admin/login/?next=/admin/", {"username": email, "password": PASSWORD})

    def test_admin_signs_in_and_can_do_everything(self):
        self.assertEqual(self.login("admin@loprig.bt").status_code, 302)
        for url in ["/admin/", "/admin/users/user/", "/admin/courses/course/", "/admin/courses/category/add/",
                    "/admin/payments/payment/", "/admin/learning/lessoncomment/"]:
            self.assertEqual(self.client.get(url).status_code, 200, url)
        self.assertFalse(User.objects.get(pk=self.admin.pk).is_site_admin)  # not turned into a site-admin account

    def test_admin_still_uses_the_website(self):
        res = self.client.post("/api/v1/auth/login/", {"email": "admin@loprig.bt", "password": PASSWORD},
                               content_type="application/json")
        self.assertEqual(res.status_code, 200, res.content)

    def test_teachers_and_students_are_refused(self):
        make_teacher()
        User.objects.create_user(email="kid@example.com", password=PASSWORD, name="Kid")
        for email in ["teacher@example.com", "kid@example.com"]:
            self.assertEqual(self.login(email).status_code, 200)  # form shown again with an error
            self.assertEqual(self.client.get("/admin/").status_code, 302)  # back to the login page

    def test_temporary_password_must_be_changed_first(self):
        self.admin.must_change_password = True
        self.admin.save()
        page = self.login("admin@loprig.bt").content.decode()
        self.assertIn("Set your own password on the website first", page)


class EnsureSiteAdminCommandTests(TestCase):
    """`ensure_site_admin` makes the Django Admin account on hosts without a shell (Render free plan)."""

    def run_command(self, **env):
        from io import StringIO
        from unittest import mock

        from django.core.management import call_command
        out = StringIO()
        with mock.patch.dict("os.environ", env, clear=False):
            call_command("ensure_site_admin", stdout=out)
        return out.getvalue()

    def test_creates_once_and_never_resets_the_password(self):
        self.assertIn("created", self.run_command(SITE_ADMIN_EMAIL="Root@Example.com", SITE_ADMIN_PASSWORD="first-pass-123"))
        admin = User.objects.get(email="root@example.com")
        self.assertTrue(admin.is_site_admin)
        self.assertIn("already exists", self.run_command(SITE_ADMIN_EMAIL="root@example.com", SITE_ADMIN_PASSWORD="other-pass-456"))
        admin.refresh_from_db()
        self.assertTrue(admin.check_password("first-pass-123"))

    def test_skips_without_settings(self):
        self.assertIn("skipped", self.run_command(SITE_ADMIN_EMAIL="", SITE_ADMIN_PASSWORD=""))
        self.assertFalse(User.objects.filter(is_superuser=True).exists())
