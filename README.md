# LOPRIG — Online Learning Platform for Bhutan

A premium, student-facing e-learning platform built with React 19 + Vite 8.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (typically http://localhost:5173).

To create a production build:

```bash
npm run build
npm run preview
```

## What's included

- Full student journey: sign up → browse/search/filter courses → course details →
  checkout (simulated payment) → payment success → video course player with
  progress tracking → dashboard → my learning → profile.
- 14 realistic demo courses with Bhutan-relevant categories, instructors, and Nu. pricing.
- Auth, enrollment, and progress state persisted to `localStorage` (no backend required).
- Fully responsive: desktop, tablet, and mobile (with a mobile nav drawer and filter drawer).
- Design system in `src/index.css` and `src/styles/*.css` — gold-on-near-black palette
  matching colorlib's "Course" template, sharp corners, soft hover shadows.
- Shared component library: SkeletonCard, SkeletonRow, EmptyState, ErrorBoundary.
- Safe localStorage wrapper with quota-exceeded handling.
- Bookmarkable filters and sort state via URL search params.

## Project structure

```
src/
├── components/   Reusable UI: Navbar, Footer, CourseCard, FilterSidebar, etc.
├── pages/        One file per route (Home, Courses, CourseDetails, Dashboard, ...)
├── context/      AuthContext, EnrollmentContext, ToastContext (all localStorage-backed)
├── hooks/        Custom hooks (useDebounce)
├── utils/        Utilities (storage.js for safe localStorage)
├── data/         Demo course, category, testimonial, and learning-path data
├── styles/       Page/section-specific CSS, imported from main.jsx
└── App.jsx       Route definitions
```

## Notes

- This is a front-end-only demo: signup/login, enrollment, and payments are all
  simulated and stored locally in the browser — there is no real backend, database,
  or payment gateway.
- No teacher or admin interfaces are included by design; this project covers only
  the student-facing experience.
- Linting: `npm run lint` (oxlint). Build: `npm run build`.
