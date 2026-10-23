# LOPRIG — Online Learning Platform for Bhutan

Student-facing e-learning platform: a **Next.js 16 + TypeScript** frontend talking to a
**Django REST Framework** API backed by **PostgreSQL**.

```
LOPRIG/
├── src/        Next.js frontend (this folder's package.json)
└── backend/    Django API — see backend/README.md
```

## Run it locally

You need Node 20+, Python 3.13 and Docker Desktop.

**1. Start the API** (first time: follow the setup steps in [backend/README.md](backend/README.md))

```bash
cd backend
docker compose -p loprig up -d
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
python manage.py runserver 8000
```

**2. Start the frontend** (in a second terminal, from the project root)

```bash
npm install
copy .env.local.example .env.local   # sets NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
npm run dev
```

Open http://localhost:3000. Demo logins (created by
`python manage.py seed_demo --with-demo-student --with-demo-teacher`):

| Who | Email | Password | Lands on |
| --- | --- | --- | --- |
| Student | `demo@loprig.app` | `password123` | `/dashboard` |
| Teacher | `tenzin.wangchuk@teachers.loprig.bt` | `password123` | `/teach` (teacher portal) |
| Admin | create with `python manage.py createsuperuser` | | http://localhost:8000/admin/ (`npm run admin`) |

## How the frontend uses the API

- `src/lib/api.ts` — fetch wrapper. The access token is kept in memory; the refresh token is
  stored in localStorage and swapped for a new access token automatically when it expires.
- `src/lib/mappers.ts` — converts API responses into the frontend's `Course` / `User` types.
- `src/context/CatalogContext.tsx` — published courses and categories, loaded once.
- `src/context/AuthContext.tsx` — register, login, logout, profile.
- `src/context/EnrollmentContext.tsx` — enrollments, progress, saved courses, streak and XP.
- Checkout creates a payment on the API; the course unlocks only after the payment gateway's
  signed webhook confirms it. Until a real gateway is chosen, the backend's mock gateway is used.

`NEXT_PUBLIC_API_URL` is baked into the build, so set it before `npm run build` for each
environment. The API must list the site's origin in `CORS_ALLOWED_ORIGINS` (backend `.env`).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3000 |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` | oxlint |
| `npm run typecheck` | TypeScript check |
| `npm run backend` | Start the database + Django API |
| `npm run admin` | Same, and open Django Admin in the browser |

## Three areas, one app

- **Student site** — everything outside `/teach`.
- **Teacher portal** — `/teach` (`src/app/teach`, `src/views/teach`, `src/components/teach`).
  Teachers create courses, build modules and lessons, submit for review and follow their
  students' progress. Teacher accounts are created by an admin (role "Teacher").
- **Admin** — Django Admin with the Lop-rig theme: platform dashboard, course approval
  (Approve / Reject buttons on each course), users, enrollments, payments.
