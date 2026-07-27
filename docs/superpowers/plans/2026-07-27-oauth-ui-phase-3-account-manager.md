# OAuth Provider UI — Phase 3: Account Manager — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the account-manager pages and dialogs on shadcn/Base UI + react-hook-form, then delete the legacy forms layer that Phase 2 could not remove.

**Architecture:** The foundation already exists — `FormShell`, the field wrappers, `AccountShell`, `Notice`/`ErrorNotice`, the identity components. This phase is mostly consumption: migrate the 5 dialogs that own forms, the 3 that are confirmation-only, the 5 page routes, and the shared `utils/*` presentational pieces. The legacy `forms/*` tree is removed last, once nothing imports it.

**Tech Stack:** As Phase 2 — React 19, react-hook-form 7, zod 3.24, shadcn/ui on Base UI (`base-nova`), Lingui, TanStack Router, Vitest.

**Predecessors:** [Phase 0–1](2026-07-27-oauth-ui-phase-0-1-foundation-shell.md), [Phase 2](2026-07-27-oauth-ui-phase-2-authorize-flow.md) — both complete, both suites at baseline.

## Global Constraints

Everything from the Phase 0–1 and Phase 2 Global Constraints still applies. The
ones this phase actually trips over:

- **Input `name` attributes** used here: `code`, `email`, `password`, `handle`,
  `domain`. With react-hook-form the field key *is* the rendered name.
- **Tag-specific assertions owned by this phase:**
  - `h2` — `Êtes-vous vraiment, vraiment sûr ?` (delete-account dialog)
  - `code` — `_atproto.<votre-domaine>` and `TXT` (custom-handle DNS instructions)
  - `span` — `Réactiver le compte`, `Désactiver le compte` (manage-page rows),
    `HTTP` (verification-method radio option label)
  - `a` — `Compte utilisateur` (already satisfied by `AccountShell`'s nav links)
  - raw selector — `[role="dialog"] button[type="submit"]`, so dialog content
    must keep `role="dialog"` and its submit must be a real `button[type=submit]`
- **`ensureNotification`** — toast text must stay reachable; already true via Sonner.
- **Never set `mode: 'onBlur'`** on a form. It renders errors under empty fields
  at first interaction and the layout shift swallows the click. See
  `8c0a69235`; use the react-hook-form default with `reValidateMode: 'onChange'`.
- **Reserve space for anything that appears conditionally** next to an
  interactive control, for the same reason.
- **Run eslint from the repo root**, not the package.

---

## Task Breakdown

### Task 1: Shared presentational utils

**Files:** `utils/description-card.tsx`, `help-card.tsx`, `dialog-simple.tsx`, `code-snippet.tsx`, `url-viewer.tsx`, `circular-progress.tsx`, `handle.tsx`, `date-ago.tsx`, `lang-string.tsx`, `link-anchor.tsx`, `link-external.tsx`, `link-title.tsx`, `icons.tsx`

Rebuild on `ui/card`, `ui/dialog`, `ui/button`; Phosphor → Lucide in `icons.tsx`.
`description-card` is the row primitive the manage page is built from — it must
keep its title in a `<span>` (the `Réactiver le compte` / `Désactiver le compte`
assertions) and remain keyboard-activatable.
`code-snippet` must keep its `<code>` elements.

### Task 2: Dialog shell

**Files:** create `components/dialogs/dialog-shell.tsx`

One wrapper over `ui/dialog` providing: trigger via `render`, title/description,
`role="dialog"` content, and a footer that hosts a `FormShell`'s action row so
`[role="dialog"] button[type="submit"]` resolves. Replaces `utils/dialog-simple.tsx`.

### Task 3: Email dialogs

**Files:** `update-email-dialog.tsx`, `update-email-form.tsx`, `verify-email-dialog.tsx`, `verify-email-confirm-form.tsx`

Both own multi-step flows (request code → confirm) and a resend button. Keeps
`name="email"`, `name="code"`, the `Envoyer le code de vérification` button, and
the "does not ask for a token when changing a non-verified email" branch.

### Task 4: Handle dialogs

**Files:** `update-handle-dialog.tsx`, `update-handle-default-form.tsx`, `update-handle-custom-form.tsx`, `forms/input-handle-custom.tsx`, `forms/input-handle-custom-instructions.tsx`, `forms/input-radio-group.tsx`

Reuses `HandleField` for the default path. The custom-domain path keeps
`name="domain"`, the DNS/HTTP verification radio (option labels in `<span>`,
including `HTTP`), and the `<code>` blocks in the instructions.

### Task 5: Password + destructive dialogs

**Files:** `update-password-dialog.tsx`, `deactivate-account-dialog.tsx`, `reactivate-account-dialog.tsx`, `delete-account-dialog.tsx`, `delete-account-confirm-form.tsx`, `oauth-session-details-dialog.tsx`

`delete-account-dialog` keeps its `<h2>` confirmation heading and `name="code"` /
`name="password"`. Destructive actions use `variant="destructive"` — replacing
the branding-error hot pink that is currently visible on the manage page.

### Task 6: Page routes

**Files:** `pages/account/(authenticated)/{page,manage/page,devices/page,apps/page,about/page,about/page.fr}.tsx`

Rebuild the row/section layout on `ui/card`. The manage page is the densest —
it composes 7 dialogs. `about/page.fr.tsx` is a French-specific variant; keep
both in sync structurally.

### Task 7: Legacy forms-layer removal

Delete, in dependency order once importers are gone: `forms/input-text.tsx`,
`input-token.tsx`, `input-email-address.tsx`, `input-password.tsx`,
`input-container.tsx`, `checkbox.tsx`, `form-card.tsx`, `smart-form.tsx`,
`form-field.tsx`, `form-context.tsx`, `fieldset-context.tsx`,
`button.tsx`, `button-async.tsx`, `button-cooldown.tsx`, `button-copy.tsx`,
`button-request-code.tsx`, `button-toggle-visibility.tsx`,
`hooks/use-merged-refs.ts`, and `use-stepper.ts` if unused.

Verify with an importer count **by import path**, not filename substring — the
substring count is misleading (it reported 44 importers for `button.tsx` when
the real set was different).

Then drop the now-unused `@radix-ui/*` dependencies.

### Task 8: Phase 3 close-out

`pnpm i18n` + French fill for anything new, both e2e suites vs the baseline,
full lint/type-check, and a visual pass over the account manager.

---

## Verification

Per task, from `packages/oauth/oauth-provider-ui`:

```bash
pnpm exec tsgo --build tsconfig.json
pnpm test
pnpm i18n && git diff -- src/locales/ | grep -E '^[+-]msgid'   # expect none unless intended
```

E2E gate after Task 5 (dialogs complete) and Task 8:

```bash
cd packages/pds && pnpm test -- tests/account-manager.test.ts
```

`account-manager.test.ts` is the suite that covers this phase; `oauth.test.ts`
should stay untouched but is worth running at close-out.
