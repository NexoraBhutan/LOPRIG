# Lop-rig API

Django + Django REST Framework backend for the Lop-rig learning platform. It is a modular
monolith: one API, one PostgreSQL database, and one Django app per responsibility.

- **Students** use the Next.js site (`/api/v1/...`).
- **Teachers** use the teacher portal at `/teach` in the Next.js site (`/api/v1/teach/...`).
- **Admins** use Django Admin, themed with Lop-rig's colours via [django-unfold](https://unfoldadmin.com).

## Run it locally

Requirements: Python 3.13, Docker Desktop.

```bash
cd backend
docker compose -p loprig up -d                # PostgreSQL 17 on localhost:5433
python -m venv .venv
.venv\Scripts\activate                         # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env                         # then set SECRET_KEY and PAYMENT_WEBHOOK_SECRET
python manage.py migrate
python manage.py seed_demo --with-demo-student --with-demo-teacher
#   student: demo@loprig.app / password123
#   teacher: tenzin.wangchuk@teachers.loprig.bt / password123
python manage.py createsuperuser               # your admin login for /admin/
python manage.py runserver 8000
```

- API: http://localhost:8000/api/v1/
- Interactive docs (Swagger): http://localhost:8000/api/docs/
- Django Admin: http://localhost:8000/admin/

Run the tests with `python manage.py test tests`.

## Apps

| App | Responsibility |
| --- | --- |
| `users` | One `users` table with a `role` (ADMIN, TEACHER, STUDENT); profile; role permissions |
| `authentication` | Register, login, JWT refresh, logout (token blacklist), password reset |
| `courses` | Categories, courses, modules, lessons, resources, publishing status |
| `enrollments` | Enrollments (free or after payment) and "save for later" |
| `learning` | Lesson content access, progress, course completion, streak and XP |
| `payments` | Checkout, gateway adapters, signed webhook verification, payment history |
| `teaching` | Teacher portal API: own courses, curriculum builder, submit for review, students |
| `certificates` | Issued on course completion; public verification by code |
| `notifications` | In-app notifications (and email) for enrollment, payment and completion |

Business logic lives in each app's `services.py`; views only validate input and call services.

## Student API

All paths are under `/api/v1/`. Send `Authorization: Bearer <access token>` for protected routes.

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| POST | `auth/register/` | public | Create a student account; returns tokens + user |
| POST | `auth/login/` | public | Email + password; returns tokens + user |
| POST | `auth/refresh/` | public | New access token (refresh tokens rotate) |
| POST | `auth/logout/` | signed in | Blacklist a refresh token |
| POST | `auth/password-reset/` | public | Email a 6-digit code (valid 10 min; a new request cancels the old code) |
| POST | `auth/password-reset/confirm/` | public | `email` + `code` + `new_password`; 5 wrong tries lock the code; signs out other devices |
| GET, PATCH | `users/me/` | signed in | Own profile |
| POST | `users/me/password/` | signed in | Change password |
| GET | `categories/`, `categories/<slug>/` | public | Categories with published course counts |
| GET | `courses/` | public | Catalogue. Filters: `category`, `level`, `price=free\|paid`, `min_rating`, `search`, `sort=popular\|rating\|newest\|price-asc\|price-desc` |
| GET | `courses/<slug>/` | public | Course page with curriculum outline (no lesson content) |
| POST | `courses/<slug>/enroll/` | student | Enroll in a free course (paid courses answer 402) |
| GET | `enrollments/`, `enrollments/<slug>/` | student | My courses with progress |
| GET, POST | `saved-courses/` | student | Wishlist |
| DELETE | `saved-courses/<slug>/` | student | Remove from wishlist |
| POST | `payments/checkout/` | student | Start paying for a course |
| GET | `payments/`, `payments/<reference>/` | student | Payment history |
| POST | `payments/webhooks/<provider>/` | gateway | Signed payment confirmation |
| POST | `payments/mock/<reference>/pay/` | student | **Dev only**: simulate the gateway (`outcome: success\|failure`) |
| GET | `learning/courses/<slug>/` | enrolled student | Course player: lessons with content and progress |
| GET | `learning/lessons/<id>/` | enrolled / preview | One lesson with content |
| POST | `learning/lessons/<id>/progress/` | enrolled student | Save `position_seconds` and/or `completed: true` |
| GET | `learning/summary/` | student | Streak, XP, counts for the dashboard |
| GET | `certificates/`, `certificates/<code>/` | student | My certificates |
| GET | `certificates/verify/<code>/` | public | Verify a certificate |
| GET | `notifications/` (`?unread=true`) | signed in | My notifications |
| GET | `notifications/unread-count/` | signed in | Badge count |
| POST | `notifications/<id>/read/`, `notifications/read-all/` | signed in | Mark read |

## Teacher API

All under `/api/v1/teach/`, teacher accounts only. Every query is limited to the signed-in
teacher's own courses, so another teacher's course answers 404.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `summary/` | Dashboard: courses by status, students, completions, earnings, recent enrollments |
| GET, POST | `courses/` | List own courses / create a draft |
| GET, PATCH, DELETE | `courses/<slug>/` | Course with curriculum; edit; delete (only unpublished, no students) |
| POST | `courses/<slug>/submit/` | Send to review (checks description, outcomes, at least one lesson) |
| GET | `courses/<slug>/students/` | Enrolled students with progress |
| POST | `courses/<slug>/modules/` | Add a module |
| PATCH, DELETE | `modules/<id>/` | Rename / reorder (`order`) / delete a module |
| POST | `modules/<id>/lessons/` | Add a lesson (video link, reading or H5P) |
| PATCH, DELETE | `lessons/<id>/` | Edit / reorder / delete a lesson |
| POST | `lessons/<id>/resources/` | Attach a resource link |
| DELETE | `resources/<id>/` | Remove a resource |

**Review workflow:** draft → *submit* → in review → admin **Approve** (published, teacher
notified) or **Reject** with a review note (teacher sees the note and can resubmit). Approve and
Reject are buttons on the course page in Django Admin.

## How payments work

1. `POST payments/checkout/` creates a `PENDING` payment and a `PENDING_PAYMENT` enrollment.
   The student has no access yet.
2. The student pays on the gateway's page.
3. The gateway calls `POST payments/webhooks/<provider>/`. The backend verifies the signature,
   checks the amount and currency match the order, then marks the payment `SUCCEEDED` and
   activates the enrollment. Replayed webhooks are ignored.

Until a real gateway is chosen, `PAYMENT_PROVIDER=mock` signs webhooks with HMAC-SHA256 using
`PAYMENT_WEBHOOK_SECRET`, and `payments/mock/<reference>/pay/` stands in for steps 2 and 3.
To add a real gateway, implement `PaymentGateway` (see `apps/payments/gateways/base.py`),
register it in `gateways/__init__.py` and set `PAYMENT_PROVIDER`.

## Not built yet


- Teacher and admin frontends (admins can already manage everything in Django Admin,
  including approving courses).
- Celery + Redis: emails are sent inline for now; certificate PDFs and video processing
  will be background jobs.
- Video storage/streaming (lessons store a `video_url` reference to the streaming service).
- H5P: lessons have an `h5p_embed_url` field for the standalone player.




