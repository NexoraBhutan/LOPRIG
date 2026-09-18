# UI.md — Lop-rig Design & Frontend Guide

This file is the reference for building any new page, component, or feature in this
codebase. Read it before adding UI so new work looks and behaves consistently with
what already exists. It documents what **is**, not what should be — update it whenever
a convention below actually changes in the code.

## 1. Stack

- **React 19** + **Vite 8**, plain JSX (no TypeScript).
- **react-router-dom v7** — `BrowserRouter` with a flat `<Routes>` tree in
  [src/App.jsx](src/App.jsx).
- **Plain CSS** — no Tailwind, no CSS-in-JS, no CSS modules. One global stylesheet
  ([src/index.css](src/index.css)) plus one hand-written CSS file per feature area
  under [src/styles/](src/styles/), all imported once in
  [src/main.jsx](src/main.jsx).
- **react-icons/fa** (Font Awesome 5 Free) for all icons — matches the
  colorlib "Course" template's icon library (see §3).
- **framer-motion** is a dependency but barely used yet — prefer plain CSS
  transitions/animations (see §5) unless a gesture/spring truly needs it.
- **No backend.** All data is local: static demo content in
  [src/data/courses.js](src/data/courses.js) and per-user state in `localStorage`
  via React Context (`AuthContext`, `EnrollmentContext`). Keep new features
  consistent with this — no fetch/axios/API layer exists.
- Linting: `oxlint` (`npm run lint`). Dev server: `npm run dev`.

## 2. Project structure

```
src/
  App.jsx              route table, wraps pages in Navbar + <main> + Footer
  main.jsx             provider tree + global CSS imports (order matters, see below)
  index.css            design tokens, resets, and every shared primitive class
  components/          shared, reusable, cross-page components
  pages/                one file per route, PascalCase matching the route's purpose
  context/             AuthContext, EnrollmentContext, ToastContext (localStorage-backed)
  data/                 static demo data (courses.js)
  styles/               one .css file per page/feature area
  assets/               images (logos, etc.)
```

New pages go in `src/pages/`, are registered in `App.jsx`, and get their own
`src/styles/<feature>.css` imported in `main.jsx`. New reusable UI goes in
`src/components/`.

## 3. Design tokens (`src/index.css`)

Everything visual is driven by CSS custom properties on `:root`. **Always reuse
these tokens — never hardcode a hex color, radius, or shadow that already has a
token.**

```css
--bg: #ffffff;
--bg-soft: #f8f9fb;      /* card backgrounds */
--bg-sunken: #eaebec;    /* price boxes, inset surfaces, input fills */
--line: #ececec;
--line-strong: #dcdcdc;

--gold: #ffb606;         /* primary brand + primary actions */
--gold-dark: #c88e00;    /* hover/active shade */
--gold-light: #ffd266;   /* lighter tint */
--gold-soft: #fff6e0;    /* very light tinted background */
--red: #ff6347;          /* danger, destructive actions */
--red-dark: #db5246;
--red-soft: #fdecea;

--ink-strong: #1a1a1a;   /* headings — near-black, not pure black */
--ink: #3a3a3a;          /* body text */
--ink-muted: #a5a5a5;    /* secondary/meta text */

--radius-sm: 2px;   --radius-md: 2px;   --radius-lg: 2px;   --radius-pill: 999px;

--shadow-soft: 0px 10px 20px rgba(0, 0, 0, 0.15);
--shadow-elevated: 0px 20px 49px rgba(0, 0, 0, 0.17);

--font-display: 'Roboto', sans-serif;   /* headings, buttons, body */
--font-body: 'Roboto', sans-serif;
--font-accent: 'Open Sans', sans-serif; /* nav links, logo wordmark, labels */

--header-h: 76px;
```

- This is a **single light theme only** — recreates the palette, type, and
  corner/shadow language of colorlib's **"Course"** Bootstrap template
  (`preview.colorlib.com/#course`): gold on near-black, sharp corners, soft
  shadows on hover instead of a glow or a 3D pressed border. There is no dark
  mode / theme toggle; don't build one unless asked.
- Currency is Bhutanese Ngultrum, shown as `Nu. 1,234` (see `toLocaleString()` usage
  in `CourseCard.jsx`) — keep this format for any price/money UI.
- **Restrained palette, not multi-hue**: gold is the one accent color (main
  CTAs, links, active states, ratings); `--red` exists only for danger/destructive
  actions. Where a UI needs several visually distinct tones side by side
  (stat-card icons, category badges, step icons), rotate between gold, near-black
  (`--ink-strong`), and — sparingly — red, rather than introducing new hues.
  See the `ICON_COLORS` rotation in `Category.jsx` or the `:nth-child` color
  rotation in `home.css`'s `.why-icon`/`.step-icon` for the pattern. This
  matches colorlib's own essentially-monochrome branding; don't reintroduce
  blue/green/purple accents.
- **Sharp corners, soft hover shadow** (see `.btn`/`.card` in §4): buttons and
  cards are near-square (`--radius-sm`/`-md`/`-lg` are all 2px) with no
  border/shadow at rest; a `box-shadow: var(--shadow-soft)` lifts in only on
  `:hover`. This replaces the earlier "chunky pressed 3D" button language
  entirely — nothing should have a colored bottom-edge shadow or a
  `translateY` press animation anymore. Buttons are uppercase, bold, and
  letter-spaced (`.btn` in `index.css`), matching colorlib's own button style.
  The one deliberate departure from the source template: colorlib puts white
  text on its gold buttons/badges, which fails contrast — this app uses
  `--ink-strong` text on gold instead (see `.btn-primary`, `.badge-bestseller`).
- **No floating decorative orbs, no glassmorphism-over-nothing.** Any
  background interest comes from the mascot illustration, a soft tinted
  section background (`--gold-soft`, `--bg-sunken`), or a genuinely floating
  overlay (`.glass`, for dropdowns/menus) — never a blurred abstract shape
  behind a hero/auth/CTA section for its own sake.
- **The mascot** (`src/components/Mascot.jsx`) is an original character — a
  Takin, Bhutan's national animal — built as inline SVG (no external image).
  Kept as Lop-rig's own identity element even though the colorlib reference
  has no mascot of its own. It takes a `pose` prop: `"idle"` (hero, general
  illustration), `"celebrate"` (success/payment/CTA moments), `"thinking"`
  (locked/gated states), `"sad"` (empty states, 404, "not found"). Use it —
  not a generic icon — for empty states and success states; see
  `Dashboard.jsx`, `MyLearning.jsx`, `Category.jsx`, `Courses.jsx`,
  `Search.jsx`, `CoursePlayer.jsx`, `NotFound.jsx`, and
  `PaymentSuccess.jsx`/`ForgotPassword.jsx` for the established call sites
  and which pose each situation uses.

## 4. Shared primitives (already in `index.css` — reuse, don't reinvent)

| Class | Use |
|---|---|
| `.container` | max-width 1280px, centered, side padding — wrap section content in this |
| `.section` | vertical page-section padding (96px, 60px on mobile) |
| `.section-head` / `.section-title` / `.section-sub` | heading row pattern used at the top of every content section |
| `.eyebrow` | small uppercase label above a heading, gold, with a short gold tick mark before it |
| `.card` | base panel: `--bg-soft` background, no border, no shadow at rest — lifts with `var(--shadow-soft)` and a slight `translateY` on hover — use only when the whole card is itself clickable (course card, category card) |
| `.card-plain` | same panel styling as `.card`, no hover lift — use for static, non-interactive content (info tiles, testimonials, stat tiles, settings panels, auth/buy/success cards) |
| `.glass` | solid white elevated panel with `--shadow-soft` (dropdowns, menus, overlays that float over real page content) — combine with a positioning class. Not for a card that isn't floating over anything (use `.card-plain` there) |
| `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.btn-danger` | sharp-cornered, uppercase, bold-letter-spaced buttons with a soft hover shadow (see §3) — sizes `.btn-sm` / `.btn-lg`; `.btn-block` for full width |
| `.badge`, `.badge-bestseller`, `.badge-new` | small pill tags on cards, solid fills (gold / near-black) — not low-opacity tints |
| `.skeleton` | shimmering loading placeholder |
| `.page-enter` | fade+rise-in animation — wrap the root `<div>` of every page in this |
| `.field`, `.input-wrap` | form field + label pattern, `.has-icon` when an icon sits inside the input |
| `.toast-stack` / `.toast` | rendered globally by `ToastProvider`, not built per-page |
| `.visually-hidden` | screen-reader-only content |
| `Mascot` (`components/Mascot.jsx`) | original Takin mascot SVG, `{ pose, size, className }` — see §3 for the pose vocabulary and established call sites |
| `StatCard` (`components/StatCard.jsx`) | labeled icon+value stat tile, `{ icon, value, label, tone }` (`tone` one of `green`/`blue`/`gold` — legacy prop names kept for callers, but each maps to a gold/near-black/red *color*, not the hue its name suggests; see `.dash-stat-icon-*` in `dashboard.css`) or pass `ring` (a `<ProgressRing/>`) instead of `icon` — used by Dashboard and Profile instead of each repeating the same markup |
| `ProgressRing` (`components/ProgressRing.jsx`) | segmented-dial "how far along" indicator, `{ value, size, tone, showValue, label }` — reserve for the one progress number that matters most on a surface (Dashboard overall completion, MyLearning/CoursePlayer's current course); use `ProgressBar` everywhere else. Always leave `flex-shrink: 0` on its wrapper in any new flex layout — see the comment on `.progress-ring` in `components.css` for why |

Before adding new CSS for a button, card, badge, form field, section header, or
loading state, check this table first — it's very likely already covered.

## 5. Motion

- Prefer plain CSS: keyframes + `transition`, following the existing patterns
  (`pageFade`, `skeleton-loading`, `toastIn` in `index.css`).
- `@media (prefers-reduced-motion: reduce)` is already handled globally — don't
  fight it or add motion that ignores it.
- Reach for `framer-motion` only for something CSS genuinely can't do well
  (drag, complex orchestrated/gesture animation) — it's installed but not the
  house style yet.

## 6. Component conventions

- **Function components**, default export, named the same as the file
  (`export default function CourseCard(...)`).
- Icons from `react-icons/fa` (Font Awesome 5 Free), sized explicitly
  (`<FaHeart size={16} />`), imported by name. Font Awesome splits outline
  and filled variants into separate components (`FaHeart`/`FaRegHeart`,
  `FaStar`/`FaRegStar`, `FaBookmark`/`FaRegBookmark`, `FaCircle`/`FaRegCircle`)
  rather than a single icon with a `fill` toggle like some other icon sets —
  swap the *component* for a saved/active/filled state, don't try to pass a
  `fill="none"` prop. Never `import * as Icons from "react-icons/fa"` with
  dynamic property access for a category/config-driven icon lookup — that
  defeats tree-shaking and pulls a large chunk of the library into the
  bundle; build an explicit `{ Key: FaIcon, ... }` map instead (see `ICONS`
  in `Category.jsx`/`Home.jsx`).
- Class names are hand-written, kebab-case, **component-name-prefixed**
  (`course-card`, `course-card-media`, `course-card-save`, `course-card-badge`,
  etc.) — this prevents collisions between per-page CSS files since there's no
  scoping mechanism. Follow this prefixing for any new component.
- Conditional classes via template literals: `` `btn ${active ? "is-active" : ""}` ``
  or `` `navbar-link ${isActive ? "active" : ""}` `` (react-router's `NavLink`
  render-prop form). State-driven modifier classes use `is-*` (`is-saved`,
  `is-active`) or bare state words matching react-router's own convention
  (`active`, `open`).
- Links: use react-router's `<Link>` / `<NavLink>` for in-app navigation, never
  `<a href>` for internal routes. External links get
  `target="_blank" rel="noopener noreferrer"` and usually an `<ExternalLink>`
  icon (see Footer, Home hero credit link).
- Accessibility: icon-only buttons get `aria-label`; toggles get
  `aria-pressed`/`aria-expanded`; live regions (`toast-stack`) get
  `aria-live="polite"`; decorative elements get `aria-hidden="true"`.
- Data-driven rendering: options/config live as top-level `const` arrays/objects
  in the component file (see `NAV_LINKS` in `Navbar.jsx`, `LEVELS`/`PRICES`/
  `RATINGS` in `FilterSidebar.jsx`, `FAQS` in `Home.jsx`) rather than inline JSX
  repetition — follow this for any list of nav items, filter options, FAQs, etc.

## 7. Page conventions

- Route registered in [src/App.jsx](src/App.jsx); wrap in `<ProtectedRoute>`
  (from `src/components/RouteUtils.jsx`) if it requires login (see
  `/dashboard`, `/my-learning`, `/profile`, `/learn/:id`, `/checkout/:id`,
  `/payment-success/:id` for the existing pattern).
- Root element of the page is `<div className="page-enter">`.
- Page gets its own CSS file in `src/styles/<name>.css`, added to the import
  list in `src/main.jsx` (import order there roughly follows nav order —
  append new files at the end unless there's a cascade reason not to).
- Section pattern inside a page:
  ```jsx
  <section className="section container">
    <div className="section-head">
      <div>
        <span className="eyebrow">…</span>
        <h2 className="section-title">…</h2>
      </div>
      {/* optional right-aligned action, e.g. a "View all" link */}
    </div>
    {/* content grid */}
  </section>
  ```
- Hero/decorative sections should build visual interest from the mascot
  (`<Mascot pose="..." />`, see §3) plus a soft blob/wash background and small
  rotated "chip" callouts with inline `style` for position — see
  `HeroVisual.jsx` and `.hero-visual`/`.hero-chip-*` in `home.css` for the
  pattern. Not floating gradient orbs (see §3).

## 8. State & data

- **Auth**: `useAuth()` from `context/AuthContext.jsx` — `{ user, ready, signup,
  login, logout, updateProfile }`. Users + current session persist in
  `localStorage` (`loprig_users`, `loprig_user`). No real backend/auth security —
  this is a demo-only auth layer.
- **Enrollment**: `useEnrollment()` from `context/EnrollmentContext.jsx` —
  `{ enrollments, enrolledCourses, savedCourses, isEnrolled, enroll, toggleSaved,
  markLessonComplete, setLastLesson, getProgress }`. Persisted per-user in
  `localStorage` under `loprig_enrollments_<userId|guest>`.
- **Toasts**: `useToast()` from `context/ToastContext.jsx` — `push(message, type)`
  with `type` one of `"success" | "error" | "info"` (default `"success"`),
  auto-dismisses after ~3.8s. Use this for all user feedback (save/remove,
  auth errors, form submission results) instead of `alert()` or inline-only
  messages.
- **Course data**: `data/courses.js` exports `courses`, `categories`,
  `instructors`, plus helpers (e.g. `getCourseById`). New demo content
  (course fields, categories) should extend this file rather than introducing
  a second data source. Keep the existing course object shape (`id`, `title`,
  `category`, `level`, `description`, `instructor`, `rating`, `students`,
  `duration`, `lessonsCount`, `price`, `discountPrice`, `language`,
  `bestseller`, `gradient`, `requirements`, `whatYouLearn`, `curriculum`) when
  adding courses.
- Provider order (outermost to innermost, in `main.jsx`):
  `AuthProvider` → `EnrollmentProvider` → `ToastProvider` → `App`. Any new
  global provider should slot in respecting this order if it depends on
  auth and/or enrollment.

## 9. External design/component resources

When building or restyling a component, pull structure/motion/visual ideas from
these three sources — but always **re-skin the output with our design tokens
(§3) and class-naming convention (§6)** rather than importing them wholesale.
None of them should be added as a runtime dependency of this project without a
deliberate, confirmed decision (see the Tailwind note below).

### [shadcn/ui](https://ui.shadcn.com/)
- A catalog of accessible, composable components (button, dialog, dropdown,
  form, table, sheet, command palette, etc.) that you **copy into your own
  repo** (via its CLI, `npx shadcn@latest add <component>`) rather than install
  as an npm package — you own and edit the resulting source.
- Built on **Tailwind CSS + Radix UI primitives + class-variance-authority
  (cva) + `clsx`/`tailwind-merge`**. None of these are in this project today —
  it's plain CSS with no Tailwind config.
- **How to use it here:** treat shadcn components as a reference for structure,
  accessibility behavior (focus trapping, keyboard nav, ARIA), and interaction
  patterns for things this codebase doesn't have yet (modals/dialogs,
  dropdown menus, popovers, command palettes, tabs, accordions, toasts-with-
  actions). Re-implement the JSX structure and a11y behavior as a plain
  component in `src/components/`, styled with hand-written CSS using our
  tokens and `.component-name` prefixing — do **not** pull in Tailwind, Radix,
  or cva just to use one shadcn component.
- If a future task genuinely calls for adopting shadcn's actual Tailwind-based
  components wholesale, that's a stack change (adding Tailwind + Radix across
  the app) — flag it and confirm with the user before installing anything,
  rather than doing it silently mid-feature.

### [React Bits](https://reactbits.dev/)
- A library of animated, copy-paste React components — text effects,
  animated/gradient backgrounds, buttons, cards, spotlight/hover effects,
  marquees, etc. Many variants are offered per component: plain CSS,
  Tailwind, and JS-animation flavors (framer-motion, GSAP, three.js/OGL
  depending on the effect), plus an installer CLI (`jsrepo`) as an
  alternative to copy-paste.
- **How to use it here:** pick the **plain-CSS or framer-motion variant**
  (framer-motion is already a dependency, see §5) — never the Tailwind
  variant. Copy the component's JSX/animation logic, then rewrite its
  className/CSS to use our tokens (`--gold`, `--bg-soft`, `--radius-*`,
  etc.) and our `component-name-part` naming convention, and drop it in
  `src/components/` with its own block in the relevant `src/styles/*.css`
  file. Good source for: animated headings, hover/press card effects,
  loading/skeleton variants, marquees for logos/testimonials — not for
  abstract gradient/orb backgrounds (see §3's no-decorative-orbs rule).
- Keep motion subtle and consistent with the existing `pageFade` feel (§5) —
  don't import a heavy three.js/GSAP effect for a small UI element.

### [GetLayers](https://www.getlayers.ai/)
- Not a component library — it's a library of **prompts** (for templates,
  3D scenes, page sections, backgrounds, gradients). You paste a prompt into
  an AI coding assistant, which generates code (by default a single
  self-contained HTML page; the prompt can be adapted to target a framework).
- **How to use it here:** use a GetLayers prompt to quickly generate a
  starting point for a visual section (e.g. a new hero, a gradient
  background treatment, a landing section) as scratch HTML/CSS, then
  **transplant the resulting markup/CSS into a proper React component**
  under `src/components/` or inline in the relevant page — following §6/§7
  conventions (tokens, class prefixing, `.page-enter`, `.container`/
  `.section`). Don't leave generated output as a standalone static HTML
  file wired into the app; it should end up looking like the rest of the
  codebase, not like a foreign drop-in.

## 10. Adding a new feature — checklist

1. Does it need a new route? Add the page in `src/pages/`, register it in
   `App.jsx`, wrap in `<ProtectedRoute>` if it needs a logged-in user.
2. Reuse tokens and shared primitives (§3, §4) before writing new CSS.
3. New CSS goes in its own `src/styles/<feature>.css`, imported in `main.jsx`.
4. Prefix all new class names with the component/page name.
5. Wrap the page root in `.page-enter`; wrap section content in
   `.container`/`.section`.
6. Use `useAuth` / `useEnrollment` / `useToast` for auth, progress, and
   feedback — don't invent parallel state mechanisms.
7. Use `react-icons/fa` icons, sized explicitly, with `aria-label` on icon-only
   controls.
8. Keep money formatted as `Nu. <amount.toLocaleString()>`.
9. Extend `data/courses.js` for new demo content rather than adding a new data
   file, unless the feature is clearly a different domain.
