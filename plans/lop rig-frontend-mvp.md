# LOPRIG Frontend MVP — Construction Plan

## Objective
Transform the LOPRIG prototype into a polished, production-ready frontend MVP with improved UI, new features, bug fixes, and comprehensive testing.

## Project Context

- **Stack**: React 19 + Vite 8, plain CSS, localStorage-backed state
- **Current state**: Working prototype with 14 demo courses, auth, enrollment, progress tracking, checkout
- **15 pages**: Home, Courses, CourseDetails, Category, Search, About, Login, Signup, ForgotPassword, Dashboard, MyLearning, CoursePlayer, Checkout, PaymentSuccess, Profile, NotFound
- **Repository**: https://github.com/yeshngedup-debug/LOPRIG.git (branch: frontend)

## Steps

### Step 1: Audit & Inventory

**Context**: Catalog all bugs, UI gaps, missing features, and technical debt in the current prototype. This becomes the source of truth for all subsequent steps.

**Task List**:
1. Run `npm run lint` and `npm run build` — document all warnings/errors
2. Test every page manually — document broken flows, UI inconsistencies, missing states
3. Check responsive behavior at 400px, 768px, 1024px, 1440px widths
4. Check keyboard navigation and screen reader compatibility
5. Review all localStorage usage for edge cases (corrupt data, quota exceeded)
6. Document all findings in `plans/audit-report.md`

**Files to Create/Modify**:
- `plans/audit-report.md` (new)

**Exit Criteria**:
- `plans/audit-report.md` exists with categorized findings (bugs, UI gaps, missing features, a11y issues)
- Each finding has severity (critical/high/medium/low) and affected file(s)

**Verification**:
```bash
npm run lint
npm run build
```

**Rollback**: Delete `plans/audit-report.md`

---

### Step 2: Design System Tokens & Responsive Foundation

**Context**: Extend CSS tokens, fix responsive breakpoints, and establish consistent spacing/typography scale. This is the foundation all UI work builds on.

**Task List**:
1. Audit existing tokens in `src/index.css` — add missing ones (spacing scale, typography scale, z-index layers)
2. Add responsive breakpoint tokens (`--bp-sm: 480px`, `--bp-md: 768px`, `--bp-lg: 1024px`, `--bp-xl: 1280px`)
3. Fix any inconsistent spacing (e.g., hardcoded px values that should use tokens)
4. Add `:focus-visible` styles for keyboard navigation
5. Add `prefers-reduced-motion` handling (already partially there)
6. Update `UI.md` to reflect new tokens

**Files to Modify**:
- `src/index.css` (tokens)
- `UI.md` (documentation)

**Exit Criteria**:
- All spacing uses token-based values (no hardcoded px for margins/padding in components)
- Responsive breakpoints are consistent across all CSS files
- `npm run build` passes clean

**Verification**:
```bash
npm run lint
npm run build
grep -r "padding:\|margin:" src/styles/ | grep -v "var(" | grep -v "0" | wc -l  # Should be minimal
```

**Rollback**: `git checkout src/index.css UI.md`

---

### Step 3: Shared Component Library

**Context**: Build missing shared components that new features and UI polish will use. Reuses existing patterns from the codebase.

**Task List**:
1. Create `src/components/Modal.jsx` — reusable modal/dialog with focus trap, escape key, backdrop click
2. Create `src/components/Tabs.jsx` — accessible tab component (for Dashboard, Profile, MyLearning)
3. Create `src/components/Accordion.jsx` — collapsible sections (for CourseDetails curriculum)
4. Create `src/components/Breadcrumb.jsx` — navigation breadcrumb
5. Create `src/components/Skeleton.jsx` — loading skeleton placeholders
6. Create corresponding CSS in `src/styles/components.css`

**Files to Create/Modify**:
- `src/components/Modal.jsx` (new)
- `src/components/Tabs.jsx` (new)
- `src/components/Accordion.jsx` (new)
- `src/components/Breadcrumb.jsx` (new)
- `src/components/Skeleton.jsx` (new)
- `src/styles/components.css` (add new styles)

**Exit Criteria**:
- Each component has proper ARIA attributes
- Each component works with keyboard navigation
- `npm run build` passes clean
- No new dependencies added (use React patterns only)

**Verification**:
```bash
npm run lint
npm run build
```

**Rollback**: `git checkout src/components/ src/styles/components.css`

---

### Step 4: UI Polish Pass — Marketing Pages

**Context**: Polish Home, About, and auth pages with improved typography, spacing, motion, and visual hierarchy. These are the first-impression pages.

**Task List**:
1. **Home page**: Improve hero section typography scale, refine card hover animations, polish FAQ accordion
2. **About page**: Improve values section layout, refine story section typography
3. **Auth pages**: Improve form field focus states, refine error message styling, polish success states
4. Add page transition animations (fade + rise-in using existing `.page-enter`)
5. Ensure all images/SVGs have proper `alt` text or `aria-hidden`
6. Test responsive behavior at all breakpoints

**Files to Modify**:
- `src/pages/Home.jsx`
- `src/pages/About.jsx`
- `src/pages/Login.jsx`
- `src/pages/Signup.jsx`
- `src/pages/ForgotPassword.jsx`
- `src/styles/home.css`
- `src/styles/about.css`
- `src/styles/auth.css`

**Exit Criteria**:
- All typography follows consistent scale (no random font sizes)
- All spacing uses design tokens
- All interactive elements have focus states
- Responsive at 400px, 768px, 1440px
- `npm run build` passes clean

**Verification**:
```bash
npm run lint
npm run build
```

**Rollback**: `git checkout src/pages/Home.jsx src/pages/About.jsx src/pages/Login.jsx src/pages/Signup.jsx src/pages/ForgotPassword.jsx src/styles/`

---

### Step 5: UI Polish Pass — App Pages

**Context**: Polish Dashboard, MyLearning, CoursePlayer, Profile, and other app pages for daily-use quality.

**Task List**:
1. **Dashboard**: Improve stat cards layout, refine continue-learning card, polish gamification UI
2. **MyLearning**: Improve tab navigation, refine course grid, polish empty states
3. **CoursePlayer**: Improve video player controls, refine sidebar, polish progress tracking UI
4. **Profile**: Improve settings list, refine edit mode, polish avatar display
5. **CourseDetails**: Improve curriculum accordion, refine buy card, polish reviews section
6. Ensure consistent spacing and typography across all app pages

**Files to Modify**:
- `src/pages/Dashboard.jsx`
- `src/pages/MyLearning.jsx`
- `src/pages/CoursePlayer.jsx`
- `src/pages/Profile.jsx`
- `src/pages/CourseDetails.jsx`
- `src/pages/Checkout.jsx`
- `src/pages/PaymentSuccess.jsx`
- `src/styles/dashboard.css`
- `src/styles/mylearning.css`
- `src/styles/player.css`
- `src/styles/profile.css`
- `src/styles/course-details.css`
- `src/styles/checkout.css`

**Exit Criteria**:
- Consistent card styles across all pages
- All empty states use Mascot component
- All loading states have skeleton placeholders
- Responsive at all breakpoints
- `npm run build` passes clean

**Verification**:
```bash
npm run lint
npm run build
```

**Rollback**: `git checkout src/pages/ src/styles/`

---

### Step 6: New Feature — Enhanced Search & Filters

**Context**: Improve search functionality with better UX, filter persistence, and URL synchronization.

**Task List**:
1. Add search debouncing (300ms) to reduce unnecessary re-renders
2. Sync filters with URL search params (bookmarkable filter state)
3. Add "clear all filters" button that's more prominent
4. Add filter count badges on mobile filter toggle
5. Add "no results" suggestions (related courses, popular courses)
6. Improve search result highlighting

**Files to Modify**:
- `src/pages/Search.jsx`
- `src/pages/Courses.jsx`
- `src/components/FilterSidebar.jsx`
- `src/styles/listing.css`

**Exit Criteria**:
- Filters persist in URL (shareable links)
- Search debounced at 300ms
- Mobile filter UX improved
- `npm run build` passes clean

**Verification**:
```bash
npm run lint
npm run build
```

**Rollback**: `git checkout src/pages/Search.jsx src/pages/Courses.jsx src/components/FilterSidebar.jsx`

---

### Step 7: New Feature — Notifications & Saved Courses UX

**Context**: Improve notification system and saved courses management.

**Task List**:
1. Add notification types: success, error, info, warning (currently only 3)
2. Add notification dismiss on click (not just auto-dismiss)
3. Add notification stack limit (max 3 visible)
4. Improve saved courses page with better empty state
5. Add "move to enrolled" action for saved courses
6. Add batch actions for saved courses (remove all, enroll all)

**Files to Modify**:
- `src/context/ToastContext.jsx`
- `src/pages/MyLearning.jsx`
- `src/styles/components.css`

**Exit Criteria**:
- Toast notifications support 4 types
- Click-to-dismiss works
- Max 3 notifications visible
- Saved courses have batch actions
- `npm run build` passes clean

**Verification**:
```bash
npm run lint
npm run build
```

**Rollback**: `git checkout src/context/ToastContext.jsx src/pages/MyLearning.jsx src/styles/components.css`

---

### Step 8: Bug Fixes

**Context**: Fix all bugs identified in Step 1 audit.

**Task List**:
1. Fix all critical/high severity bugs from audit report
2. Fix all medium severity bugs that affect UX
3. Add error boundaries for graceful error handling
4. Add 404 handling for invalid course IDs
5. Fix any localStorage edge cases (corrupt data, quota exceeded)
6. Fix any accessibility issues found in audit

**Files to Modify**:
- Various (based on audit findings)

**Exit Criteria**:
- All critical/high bugs fixed
- All medium bugs fixed
- Error boundaries added
- `npm run build` passes clean

**Verification**:
```bash
npm run lint
npm run build
```

**Rollback**: `git checkout .`

---

### Step 9: Testing — Unit & Integration

**Context**: Add comprehensive tests for components, contexts, and critical flows.

**Task List**:
1. Set up testing framework (Vitest + React Testing Library)
2. Write tests for AuthContext (signup, login, logout, profile update)
3. Write tests for EnrollmentContext (enroll, save, progress tracking)
4. Write tests for ToastContext (push, dismiss, auto-dismiss)
5. Write tests for critical components (CourseCard, FilterSidebar, Modal, Tabs)
6. Write tests for critical pages (Login, Signup, Dashboard, CoursePlayer)
7. Achieve 80%+ code coverage

**Files to Create/Modify**:
- `vitest.config.js` (new)
- `src/__tests__/` directory (new)
- `src/context/__tests__/` (new)
- `src/components/__tests__/` (new)
- `src/pages/__tests__/` (new)
- `package.json` (add test scripts)

**Exit Criteria**:
- `npm run test` passes
- 80%+ code coverage
- All critical paths tested
- No test flakes

**Verification**:
```bash
npm run test
npm run test:coverage
```

**Rollback**: `git checkout package.json && rm -rf src/__tests__ vitest.config.js`

---

### Step 10: Testing — E2E

**Context**: Add end-to-end tests for critical user flows using Playwright.

**Task List**:
1. Set up Playwright configuration
2. Write E2E test: Signup → Login → Dashboard
3. Write E2E test: Browse Courses → Course Details → Enroll → Checkout → Payment Success
4. Write E2E test: Search → Filter → Course Details
5. Write E2E test: My Learning → Continue Course → Progress Tracking
6. Write E2E test: Profile → Edit Profile → Save

**Files to Create/Modify**:
- `playwright.config.js` (new)
- `e2e/` directory (new)
- `package.json` (add e2e scripts)

**Exit Criteria**:
- `npx playwright test` passes
- All critical user flows covered
- Tests run in CI-ready configuration

**Verification**:
```bash
npx playwright test
```

**Rollback**: `git checkout package.json && rm -rf e2e playwright.config.js`

---

### Step 11: Performance & Bundle Optimization

**Context**: Optimize bundle size, loading performance, and runtime performance.

**Task List**:
1. Analyze bundle size with `npm run build -- --analyze`
2. Add React.lazy for route-based code splitting
3. Add Suspense boundaries for loading states
4. Optimize images/SVGs (compress, proper sizing)
5. Add proper caching headers in vite.config.js
6. Remove any unused dependencies
7. Run Lighthouse audit and fix issues

**Files to Modify**:
- `src/App.jsx` (lazy loading)
- `vite.config.js` (build optimization)
- `package.json` (remove unused deps)

**Exit Criteria**:
- Bundle size reduced by 20%+
- First Contentful Paint < 2s
- Lighthouse score > 90
- `npm run build` passes clean

**Verification**:
```bash
npm run build
npx vite build --analyze
```

**Rollback**: `git checkout src/App.jsx vite.config.js package.json`

---

### Step 12: Final Review & Deploy Prep

**Context**: Final adversarial review, visual QA, and deployment preparation.

**Task List**:
1. Run full test suite (unit + E2E)
2. Visual QA at all breakpoints (400px, 768px, 1024px, 1440px)
3. Accessibility audit (axe-core)
4. Security review (no secrets in code, proper CSP)
5. Update README.md with setup instructions
6. Create deployment configuration (Vercel/Netlify)
7. Tag release as `v1.0.0-mvp`

**Files to Modify**:
- `README.md`
- `vercel.json` or `netlify.toml` (new)
- `package.json` (version bump)

**Exit Criteria**:
- All tests pass
- No console errors
- Accessibility score > 90
- Deployment config ready
- README complete

**Verification**:
```bash
npm run test
npm run build
npm run lint
```

**Rollback**: `git checkout .`

---

## Parallelism Summary

| Step | Depends On | Can Parallelize With |
|---|---|---|
| 1 (Audit) | None | — |
| 2 (Tokens) | 1 | — |
| 3 (Components) | 2 | — |
| 4 (UI Polish Marketing) | 2 | 5 |
| 5 (UI Polish App) | 2 | 4 |
| 6 (Search & Filters) | 3 | 7 |
| 7 (Notifications) | 3 | 6 |
| 8 (Bug Fixes) | 4, 5, 6, 7 | — |
| 9 (Unit Tests) | 8 | — |
| 10 (E2E Tests) | 9 | — |
| 11 (Performance) | 10 | — |
| 12 (Final Review) | 11 | — |

## Model Tier Assignments

| Step | Model Tier | Reason |
|---|---|---|
| 1 | Default | Research/documentation |
| 2 | Strongest | Design decisions affect all downstream work |
| 3 | Default | Implementation follows existing patterns |
| 4 | Strongest | UI polish requires design judgment |
| 5 | Strongest | UI polish requires design judgment |
| 6 | Default | Feature implementation |
| 7 | Default | Feature implementation |
| 8 | Default | Bug fixes |
| 9 | Default | Testing |
| 10 | Strongest | E2E tests require careful flow design |
| 11 | Default | Performance optimization |
| 12 | Strongest | Final review requires adversarial thinking |

## Estimated Effort

- **Step 1**: 1-2 hours
- **Steps 2-3**: 2-3 hours
- **Steps 4-5**: 4-6 hours
- **Steps 6-7**: 2-3 hours
- **Step 8**: 2-4 hours (depends on audit findings)
- **Steps 9-10**: 4-6 hours
- **Steps 11-12**: 2-3 hours

**Total**: 17-27 hours of agent work

## Success Criteria

1. All pages polished with consistent design system
2. New features (search, notifications) working
3. All known bugs fixed
4. 80%+ test coverage
5. E2E tests for critical flows
6. Bundle size optimized
7. Accessibility compliant
8. Ready for deployment
