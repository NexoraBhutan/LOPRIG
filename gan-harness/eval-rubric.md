# Evaluation rubric — Lop-rig frontend transform

Score each round 0–10 per category, live against the running app
(http://localhost:5183) via chrome-devtools MCP screenshots — not by reading
source alone. Weighted total must reach 7.5 to pass a round.

### Design Quality (weight: 0.35)
- Clear visual hierarchy; the primary action/content per page is unambiguous.
- Spacing rhythm is consistent within and across sections (no ad-hoc gaps).
- Typography scale is legible and intentional at both desktop and mobile.
- Color is used with restraint and purpose (see anti-patterns in spec.md) —
  not a one-note violet wash.
- Empty/loading states look designed, not forgotten.

### Originality (weight: 0.30)
- At least one genuinely distinctive idea per round (the progress-ring motif,
  an unusual-but-legible layout, a considered micro-interaction) — not just
  "clean Bootstrap-template" competence.
- Does not read as a generic AI-generated SaaS template (gradient-badge
  everything, icon-in-circle grids, floating glass cards, stock hero copy).
- Marketing vs. app-surface tone split from spec.md is respected — app
  surfaces are quiet/dense, not landing-page styled.

### Craft (weight: 0.25)
- No visual regressions: overlapping text, broken responsive layout, unreadable
  contrast, misaligned icons.
- Follows UI.md conventions: token reuse (no hardcoded hex where a token
  exists), `.card` vs `.card-plain` hover discipline, component reuse over
  duplicated markup, class-name prefixing.
- Motion (if any) is subtle and clarifies state, per UI.md §5.
- `npm run build` passes clean.

### Functionality (weight: 0.10)
- Existing behavior (routing, auth-gated pages, enroll/save/progress flows,
  toasts) still works after the visual changes — this is a redesign pass, not
  a rewrite, so nothing should break.

## Evaluator process per round
1. Read the generator's summary of what changed and which routes.
2. For each changed route: `navigate_page` → `take_screenshot` at desktop
   width, `resize_page` to ~400px → `take_screenshot` again.
3. Check `list_console_messages` for new errors introduced by the round.
4. Score against the four categories above with specific evidence
   (route + what you saw), not vibes.
5. If below 7.5, give the generator concrete, actionable fixes tied to
   specific routes/selectors — not "make it better."
