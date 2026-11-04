donesett# LOPRIG Audit Report

## Overview
This document catalogs all bugs, UI gaps, missing features, and technical debt in the current prototype.

**Date**: 2026-09-18
**Auditor**: opencode

## Executive Summary

- **Build Status**: ✅ Passes clean
- **Lint Status**: ⚠️ 9 warnings (0 errors)
- **Critical Issues**: 0
- **High Severity Issues**: 3
- **Medium Severity Issues**: 8
- **Low Severity Issues**: 6

---

## Critical Issues
None identified.

---

## High Severity Issues

### H1: localStorage Quota Exceeded Not Handled
**Affected Files**: 
- `src/context/AuthContext.jsx:16,35`
- `src/context/EnrollmentContext.jsx:60,69`

**Description**: `localStorage.setItem()` can throw `QuotaExceededError` when storage is full. No try/catch wrapping these calls.

**Impact**: App crashes silently when localStorage is full. User data may be lost.

**Reproduction**: Fill localStorage to capacity, then try to signup or enroll.

**Fix**: Wrap all `localStorage.setItem()` calls in try/catch blocks.

---

### H2: Navigate Called During Render (Checkout)
**Affected Files**: 
- `src/pages/Checkout.jsx:25-28`

**Description**: `navigate("/login")` is called directly during render when `!user`. This is a React anti-pattern that can cause issues with concurrent features.

**Impact**: May cause unexpected behavior in React 18+ concurrent mode.

**Reproduction**: Navigate to `/checkout/some-id` while logged out.

**Fix**: Use `useEffect` or `Navigate` component for redirect:
```jsx
if (!user) return <Navigate to="/login" state={{ from: `/checkout/${id}` }} replace />;
```

---

### H3: setTimeout Without Cleanup (Checkout)
**Affected Files**: 
- `src/pages/Checkout.jsx:40-46`

**Description**: `handlePay` uses `setTimeout` without cleanup. If component unmounts before timeout fires, it will try to call `enroll` and `navigate` on unmounted component.

**Impact**: Memory leak, potential console warnings, possible state update on unmounted component.

**Reproduction**: Click "Pay" then quickly navigate away before 1.8s timeout.

**Fix**: Use `useRef` to store timeout ID and cleanup in `useEffect`:
```jsx
const timeoutRef = useRef();
useEffect(() => () => clearTimeout(timeoutRef.current), []);
```

---

## Medium Severity Issues

### M1: Unused Variable in AuthContext
**Affected Files**: 
- `src/context/AuthContext.jsx:88`

**Description**: `password` is destructured in `publicUser()` but never used. Lint warning.

**Impact**: Code smell, potential confusion.

**Fix**: Rename to `_password` or use rest operator differently.

---

### M2: setState in Effect (Multiple Files)
**Affected Files**: 
- `src/context/AuthContext.jsx:26`
- `src/context/EnrollmentContext.jsx:53`
- `src/components/Navbar.jsx:41`

**Description**: Calling `setState` synchronously within `useEffect` can trigger cascading renders.

**Impact**: Performance issue, potential infinite render loops.

**Fix**: Derive values during render or initialize state directly.

---

### M3: Video Player Non-Functional Controls
**Affected Files**: 
- `src/pages/CoursePlayer.jsx:106-111`

**Description**: Video scrubber width is hardcoded (38% or 12%), video time is hardcoded ("4:12" or "1:20"), volume/settings/fullscreen buttons do nothing.

**Impact**: Fake video player UI is confusing. Users expect these controls to work.

**Fix**: Either make controls functional or remove them to avoid confusion.

---

### M4: Lesson Items Missing Keyboard Handlers
**Affected Files**: 
- `src/pages/CoursePlayer.jsx:152-162`

**Description**: Lesson items have `onClick` and `role="button"` but no `onKeyDown` handler. Keyboard users cannot navigate the curriculum.

**Impact**: Accessibility violation (WCAG 2.1.1 Keyboard).

**Fix**: Add `onKeyDown` handler:
```jsx
onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') goTo(l.id); }}
```

---

### M5: Tabs Missing aria-selected
**Affected Files**: 
- `src/pages/MyLearning.jsx:66-69`

**Description**: Tab buttons don't have `aria-selected` attribute.

**Impact**: Screen readers cannot identify which tab is active.

**Fix**: Add `aria-selected={tab === t}` to each tab button.

---

### M6: Settings Buttons Non-Functional
**Affected Files**: 
- `src/pages/Profile.jsx:70-73`

**Description**: "Account Settings", "Notification Settings", "Password", and "Privacy" buttons have no `onClick` handlers.

**Impact**: Users click buttons expecting action but nothing happens.

**Fix**: Either add functionality or remove buttons until ready.

---

### M7: Stale Form State in Profile
**Affected Files**: 
- `src/pages/Profile.jsx:16`

**Description**: `form` state is initialized with `user?.name` and `user?.bio` but won't update if `user` changes after initial render.

**Impact**: If user data changes (e.g., after profile update), form shows stale values.

**Fix**: Use `useEffect` to sync form with user data, or use controlled inputs directly.

---

### M8: parseFloat Duration Could Return NaN
**Affected Files**: 
- `src/pages/Dashboard.jsx:23`
- `src/pages/Profile.jsx:21`

**Description**: `parseFloat(c.duration)` could return NaN if duration string is not a valid number.

**Impact**: "Learning Hours" stat could show "NaNh".

**Fix**: Add fallback: `parseFloat(c.duration) || 0`.

---

## Low Severity Issues

### L1: Remember Me Checkbox Does Nothing
**Affected Files**: 
- `src/pages/Login.jsx:16,62`

**Description**: "Remember me" checkbox state is tracked but never used in the login function.

**Impact**: User expects persistent login but gets none.

**Fix**: Implement localStorage-based session persistence or remove checkbox.

---

### L2: Signup Checkbox Missing preventDefault
**Affected Files**: 
- `src/pages/Signup.jsx:95`

**Description**: "I agree to Terms" checkbox onChange doesn't prevent default.

**Impact**: Could cause form submission when toggling checkbox.

**Fix**: Add `e.preventDefault()` or use proper event handler.

---

### L3: Password Toggle aria-label Inconsistent
**Affected Files**: 
- `src/pages/Signup.jsx:73`

**Description**: aria-label says "Toggle password visibility" but doesn't indicate current state.

**Impact**: Screen reader users don't know current state.

**Fix**: Use dynamic label like Login does: `aria-label={showPw ? "Hide password" : "Show password"}`.

---

### L4: No Loading States for Data-Dependent Pages
**Affected Files**: 
- All pages using `useEnrollment()`

**Description**: Pages render immediately with empty data before localStorage loads.

**Impact**: Flash of empty content on page load.

**Fix**: Add loading states or use `ready` flag from context.

---

### L5: No Error Boundaries
**Affected Files**: 
- `src/App.jsx`

**Description**: No error boundaries to catch and display errors gracefully.

**Impact**: Any uncaught error crashes the entire app with white screen.

**Fix**: Add error boundary components around routes.

---

### L6: Missing Meta Tags
**Affected Files**: 
- `src/pages/` (all pages)

**Description**: No page-specific meta tags (title, description, OG tags).

**Impact**: Poor SEO, no social sharing previews.

**Fix**: Add react-helmet or use Vite's HTML template.

---

## UI Gaps

### U1: No Skeleton Loading States
**Description**: Pages show empty content while data loads from localStorage.

### U2: No Page Transition Animations
**Description**: Pages switch instantly without visual transition.

### U3: Inconsistent Empty States
**Description**: Some pages use Mascot component, others don't.

### U4: No Confirmation Dialogs
**Description**: Destructive actions (logout, delete) happen immediately without confirmation.

---

## Missing Features

### F1: Search Debouncing
**Description**: Search triggers on every keystroke, no debouncing.

### F2: Filter URL Sync
**Description**: Filters are not synced with URL (not bookmarkable).

### F3: Notification Types
**Description**: Only 3 notification types (success, error, info). Missing warning type.

### F4: Batch Actions
**Description**: No batch actions for saved courses (remove all, enroll all).

---

## Accessibility Issues

### A1: Missing Focus Styles
**Description**: Some interactive elements lack visible focus indicators.

### A2: Color Contrast
**Description**: Some text colors may not meet WCAG AA contrast requirements.

### A3: Skip Navigation Link
**Description**: No skip-to-content link for keyboard users.

### A4: ARIA Landmarks
**Description**: Some pages missing proper ARIA landmarks.

---

## Technical Debt

### T1: No Testing
**Description**: Zero tests (unit, integration, or E2E).

### T2: No TypeScript
**Description**: Plain JSX without type checking.

### T3: No Backend Integration
**Description**: All data in localStorage, no real API.

### T4: No Environment Variables
**Description**: No `.env` file for configuration.

---

## Recommendations

### Immediate (High Priority)
1. Fix H1 (localStorage error handling)
2. Fix H2 (navigate during render)
3. Fix H3 (setTimeout cleanup)

### Short Term (Medium Priority)
1. Fix all medium severity issues
2. Add skeleton loading states
3. Add error boundaries

### Long Term (Low Priority)
1. Add tests (80%+ coverage)
2. Add TypeScript
3. Add backend integration

---

## Next Steps

1. **Step 2**: Design System Tokens & Responsive Foundation
2. **Step 3**: Shared Component Library
3. **Step 4**: UI Polish Pass — Marketing Pages
4. Continue through blueprint steps...

