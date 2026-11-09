# Lop-rig technology stack

Lop-rig is an online learning platform with three kinds of users: students, teachers and site admins.
It is built as two separate parts that talk over a JSON API:

```
Browser ──▶ Frontend (Next.js, React)  ──HTTP/JSON──▶  Backend API (Django REST Framework)  ──▶  PostgreSQL
                    │                                          │
                    └── video upload (TUS) ──▶ Bunny Stream ◀──┘ (signed upload tickets, webhooks)
                                                               └──▶ Gmail SMTP (emails), Google (sign-in)
```

## Frontend

| Area | Technology | Version | Used for |
|---|---|---|---|
| Language | TypeScript | 5.9 | All frontend code, with strict types |
| Framework | Next.js (App Router) | 16.3 | Pages and routing (`src/app/`), production build |
| UI library | React | 19.2 | Components and state (hooks, context) |
| Styling | Tailwind CSS (via `@tailwindcss/postcss`) | 4.3 | All styling; theme colours and fonts in `src/app/globals.css` |
| Animation | Framer Motion | 13.2 | Page and card entrance animations |
| Animation | GSAP + `@gsap/react` | 3.15 / 2.1 | Scroll and hero animations (About, course details) |
| Icons | Phosphor Icons (`@phosphor-icons/react`) | 2.1 | Every icon in the interface |
| Video upload | tus-js-client | 4.3 | Resumable uploads straight from the browser to Bunny Stream |
| Fonts | `next/font/google` (Outfit, Space Grotesk) + Cabinet Grotesk | – | Body and display type |
| Sign-in | Google Identity Services | – | "Continue with Google" button |
| Lint | oxlint | 1.79 | `npm run lint` |
| Type check | `tsc --noEmit` | – | `npm run typecheck` |
| Browser automation | playwright-core | 1.63 | Screenshots and checks during development |
| Runtime | Node.js | 24 | Runs the Next.js dev server and build |

**How the frontend is organised**

- `src/app/`: one folder per route (home, courses, learn, my-learning, profile, certificates, checkout, login/signup, `teach/` teacher portal, `admin/` site admin portal).
- `src/views/`: the page components; `src/components/`: shared pieces (quiz panel, video player, comments, avatars, portal shell).
- `src/context/`: app-wide state with React Context: login session (`AuthContext`), course catalogue, enrollments, toast messages.
- `src/lib/api.ts`: the API client. Keeps the access token in memory and the refresh token in `localStorage`, and refreshes automatically when a request returns 401.
- Printing: the certificate page has print CSS (`@page`, A4 landscape) so "Download PDF" makes a single page.

## Backend

| Area | Technology | Version | Used for |
|---|---|---|---|
| Language | Python | 3.13 | All backend code |
| Framework | Django | 6.1 | Models, ORM, migrations, admin, email, security |
| API | Django REST Framework | 3.18 | REST endpoints, serializers, permissions, pagination, rate limits |
| Authentication | djangorestframework-simplejwt | 5.5 | JWT access tokens (15 min) and refresh tokens (7 days, rotated and blacklisted) |
| API docs | drf-spectacular | 0.30 | OpenAPI schema and Swagger UI |
| Filtering | django-filter | 26.2 | Query filters on list endpoints |
| CORS | django-cors-headers | 4.9 | Lets the frontend's address call the API |
| Settings | django-environ | 0.14 | Reads secrets and settings from `backend/.env` |
| Admin theme | django-unfold | 0.110 | Styled Django admin at `/admin/` |
| Database driver | psycopg 3 (binary) | 3.3 | Connects Django to PostgreSQL |
| Tests | Django test runner + DRF `APITestCase` | – | 158 automated API tests in `backend/tests/` |

**Django apps** (`backend/apps/`)

| App | What it handles |
|---|---|
| `users` | Custom user model (email login, roles STUDENT / TEACHER / ADMIN), profile photos |
| `authentication` | Sign up, log in, token refresh, Google sign-in, password reset, log out everywhere |
| `courses` | Categories, courses, chapters, lessons, resources, cover images, chapter quizzes and questions |
| `enrollments` | Who is enrolled in what, free enrollment, access checks |
| `payments` | QR-code payments with screenshot upload and admin approval |
| `learning` | Course player, lesson progress, view counts, comments, quiz attempts and grading |
| `certificates` | Certificates of completion and the public verify page |
| `notifications` | In-app notifications and branded HTML emails |
| `teaching` | Teacher portal API: course editor, video uploads, quiz editor, marking written answers |
| `platform_admin` | Site admin API: users, teachers, course approval, payments, settings |

## API

- **Style:** REST with JSON, versioned under `/api/v1/`.
- **Main groups:** `/auth/`, `/users/`, `/courses/`, `/enrollments/`, `/learning/`, `/payments/`, `/certificates/`, `/notifications/`, `/teach/`, `/manage/`.
- **Auth:** `Authorization: Bearer <access token>`; every endpoint checks the user's role.
- **Docs:** OpenAPI schema at `/api/schema/`, interactive Swagger UI at `/api/docs/`.
- **Rate limits:** login 10/min, password reset 5/hour, comments 30/hour.
- **Pagination:** 20 items per page.
- **Incoming webhooks:** Bunny Stream video status; payment webhook signed with a shared secret.

## Database and storage

| What | Technology |
|---|---|
| Database | PostgreSQL 17, run locally in Docker (`postgres:17-alpine`, port 5433) |
| Schema changes | Django migrations |
| Uploaded files (profile photos, course covers, payment screenshots, QR codes) | Django media storage on the server's disk (`backend/media/`) |
| Lesson videos | Bunny Stream (see below) |

## Outside services

| Service | Used for |
|---|---|
| **Bunny Stream** | Hosting and streaming lesson videos. The backend signs short-lived upload tickets and token-protected playback links, so paid lessons can't be shared. |
| **YouTube / Vimeo** | Optional lesson videos by link (embedded player) |
| **Google Identity (OAuth 2.0)** | "Continue with Google" sign-in and the user's Google profile picture; the backend verifies Google's ID token |
| **Gmail SMTP** (loprig26@gmail.com, App Password) | Emails: password resets, teacher logins, payment and course notifications, quiz reviews |
| **H5P** | Interactive lessons, embedded by link |

## Security

- Passwords hashed by Django (PBKDF2), never stored or shown in plain text.
- Short-lived JWT tokens with refresh-token rotation and blacklisting ("log out everywhere").
- Role-based permissions on every endpoint; teachers only see their own courses and students.
- Rate limiting on login, password reset and comments.
- CORS limited to the frontend's address; production mode turns on HTTPS redirect, secure cookies and HSTS.
- Secrets live only in `backend/.env`, which is never committed.
- Uploaded images are checked for type and size.

## Development tools

| Tool | Used for |
|---|---|
| Git + GitHub (`NexoraBhutan/LOPRIG`) | Version control and code hosting |
| Docker | Running PostgreSQL locally |
| Python virtual environment (`backend/.venv`) + pip | Backend dependencies |
| npm | Frontend dependencies and scripts (`dev`, `build`, `lint`, `typecheck`, `backend`) |
| PowerShell scripts (`backend/start.ps1`, `setup-email.ps1`) | Starting the backend, setting up email |
| VS Code | Code editor |

## Planned for deployment

| Part | Plan |
|---|---|
| Frontend | Vercel |
| Backend + PostgreSQL + uploaded files | Railway (gunicorn web server, whitenoise for admin styling, a disk volume for uploads) |
