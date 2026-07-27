# OAuth Provider UI — Phase 4: Close-out — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the legacy token scale that phases 1–3 deliberately kept alive, and leave the package's documentation describing what actually exists.

**Architecture:** Purely subtractive. Every component now styles itself with shadcn tokens, so the `--branding-color-*` derivation, the `--color-contrast-*` / `--color-primary-*` scales and the `text-text-default` / `bg-contrast-0` body classes have no consumers left. Removing them is the last step of the migration, not a refactor.

**Predecessors:** [Phase 0–1](2026-07-27-oauth-ui-phase-0-1-foundation-shell.md), [Phase 2](2026-07-27-oauth-ui-phase-2-authorize-flow.md), [Phase 3](2026-07-27-oauth-ui-phase-3-account-manager.md) — all complete, both suites at baseline.

## Global Constraints

All previous Global Constraints still apply. Specific to this phase:

- **This phase edits `packages/oauth/oauth-provider`** — one line in
  `src/router/assets/assets.ts`. It is the only file outside
  `oauth-provider-ui` the whole project touches, and it must not touch
  `build-customization-css.ts` or the `CustomizationData` contract.
- **The server keeps injecting `--branding-color-*`.** Removing the CSS that
  *consumes* those variables does not remove the injection, and must not: the
  branding contract is preserved so colour can be layered back in later
  (spec, "Constraint: branding").
- **Verify by absence.** After removing a token, `grep` for it across `src`
  *and* the built `dist/*.css` — a class that no longer resolves fails silently
  rather than at build time.

---

## Task Breakdown

### Task 1: Confirm the error pages

**Files:** `src/error-page.tsx`, `src/cookie-error-page.tsx`, `src/components/error-view.tsx`

These already import `AppShell`, `Notice`, `ui/button` and the feedback
components — they were migrated incidentally during phases 1–3. This task only
verifies that, visually and by import audit; no rewrite is expected. If an
import audit turns up something legacy, migrate it here.

### Task 2: Remove the legacy token scale

**Files:** `src/style.css`

Delete, in this order:

1. The `:root` block defining `--branding-color-*` defaults.
2. The `:root` block deriving `--hue-*`, `--color-primary`, `--color-error`,
   `--color-warning`, `--color-info`, `--color-success` and their `-contrast`
   variants.
3. The `--color-{primary,error,warning,info,success}-{25..975}` scales and the
   `@theme inline` block that exposes them.
4. The `--color-contrast-{0..1000}` scale, its `prefers-color-scheme` dark
   override, and its `@theme inline` block, including
   `--color-text-default` / `--color-text-light`.
5. The two `@source inline(...)` directives.

Keep: the `@custom-variant dark`, the shadcn token blocks, the `@theme inline`
mapping, `--space-screen`, and the `@tailwindcss/typography` plugin.

Then widen the base layer from `[data-slot]` to `*`, which is what upstream
shadcn ships — the `[data-slot]` scoping existed only to avoid restyling legacy
components that no longer exist.

Update `src/lib/theme.test.ts`: its `LEGACY_TOKENS` assertions must be replaced
with assertions that those tokens are **gone**, otherwise the test enforces the
thing being removed.

### Task 3: Body classes

**Files:** `packages/oauth/oauth-provider/src/router/assets/assets.ts:114`, and
`{authorization,account,error,cookie-error}-page.html`

Change `text-text-default bg-contrast-0` to `text-foreground bg-background` in
all five places.

### Task 4: Dependency sweep

Remove any dependency with no importer left. Check by path, not filename
substring. `@radix-ui/primitive` is still used (`composeEventHandlers` in
`error-notice.tsx`) — confirm before removing anything.

### Task 5: Rewrite `CLAUDE.md`

**Files:** `packages/oauth/oauth-provider-ui/CLAUDE.md`

The current file documents `SmartForm`, `FormCard`, the `input-*` family and a
"components are pure, pages own the data" layering — none of which survive. It
is now actively misleading. Rewrite to describe:

- shadcn/ui on Base UI (`base-nova`), regenerated via the CLI, `#/` not `@/`
- `FormShell` + `useForm` + zod schemas in `lib/form-schemas.ts`
- the field wrappers under `components/forms/fields/`
- `DialogShell` / `ConfirmForm` for dialogs
- the i18n rules (msgid = source string, `<Trans>` placeholders are positional,
  never pass `t` as a prop — it breaks the macro)
- the pds e2e DOM contract, with a pointer to the spec's two tables
- eslint runs from the repo root, not the package
- never `mode: 'onBlur'` on a form

### Task 6: Final verification

Full type-check, lint, unit tests, `pnpm i18n` with no msgid change, both e2e
suites against the baseline, and a visual pass over all four entry pages in
light and dark via the mock dev server.

---

## Verification

```bash
cd packages/oauth/oauth-provider-ui
pnpm exec tsgo --build tsconfig.json && pnpm test && pnpm run build:ui
pnpm i18n && git diff -- src/locales/ | grep -E '^[+-]msgid'   # expect none

# absence checks
grep -rE "text-text-|contrast-[0-9]|branding-color" src/ dist/*.css
```

eslint from the repo root. Both suites from `packages/pds`.
