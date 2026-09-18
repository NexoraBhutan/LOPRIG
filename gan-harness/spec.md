# Design brief — Lop-rig frontend transform

## Project
Lop-rig, a Bhutanese e-learning marketplace/LMS. React 19 + Vite, plain CSS
(no Tailwind/CSS-in-JS), single dark theme. See [UI.md](../UI.md) for the
full frontend contract (tokens, primitives, class-naming, page conventions) —
this transform must stay inside that contract, not replace it.

Dev server: `npm run dev` → http://localhost:5183 (already running in this
session on that port; if not, start it with `npm run dev -- --port 5183`).

## Starting point
A prior pass already stripped generic "AI-slop" patterns: floating blurred
gradient orbs, glassmorphism-over-nothing, the violet→blue gradient smeared
across every badge/icon/underline, a glowing wireframe-globe hero, duplicated
stat/feature grids, and stock marketing copy. `--grad-brand` is now reserved
for the primary button and the logo mark; everything else uses flat
`--violet`. This brief is the *next* pass: take the now-clean baseline and
push it toward something genuinely distinctive and polished — not just
"inoffensive," but memorable.

## Direction
- **Purpose**: browse/evaluate courses, enroll, learn, track progress.
- **Audience split**: marketing surfaces (Home, About) can be editorial and
  confident. App surfaces (Dashboard, MyLearning, CoursePlayer, Checkout,
  Courses listing) are for repeat daily use — dense, quiet, scannable, no
  landing-page theatrics.
- **Tone**: refined editorial-utilitarian. Confident, not maximal.
- **Signature motif to develop**: the Logo mark is three ascending bars
  (a growth/progress glyph). Progress is the core object of an LMS — find a
  tasteful way to extend that motif into a distinctive progress treatment
  (e.g. a custom circular/segmented progress ring, not just a pill bar) used
  on Dashboard, MyLearning, and CourseDetails/CoursePlayer, so the brand mark
  and the product's core mechanic visually rhyme.
- **Constraints**: stay in plain CSS + the existing token set in
  `src/index.css`; extend tokens if genuinely needed but don't fork the
  system. Keep `.card` (hover-lift) vs `.card-plain` (static) discipline.
  Reuse `StatCard`, `CourseCard`, `CourseThumb`, `ProgressBar` etc. rather
  than duplicating markup. Single dark theme only — no light mode.

## Scope
Full visual pass across every route: Home, Courses, CourseDetails, Category,
Search, About, Login, Signup, ForgotPassword, Dashboard, MyLearning,
CoursePlayer, Checkout, PaymentSuccess, Profile, NotFound.

Improve: layout rhythm and vertical spacing, typographic hierarchy (headline
scale, label/body contrast), card and list treatments, empty/loading states,
the progress motif above, and responsive behavior down to ~400px width.

## Anti-patterns (do not reintroduce)
Purple-gradient-everywhere, decorative blobs/orbs, glass floating over
nothing, oversized generic hero cards, vague marketing copy, cards nested
inside cards, one-note palette, motion that's decorative rather than
state-clarifying.

## Definition of done for one iteration
A round touches a coherent slice of the app (e.g. "app surfaces: Dashboard +
MyLearning + CoursePlayer + the new progress-ring motif", or "marketing
surfaces: Home + About + auth pages") rather than one-line tweaks scattered
everywhere. `npm run build` must stay green. Every changed page must be
visually verified live (chrome-devtools MCP: navigate, screenshot) at both
desktop (~1440px) and mobile (~400px) width before handing off to the
evaluator.
