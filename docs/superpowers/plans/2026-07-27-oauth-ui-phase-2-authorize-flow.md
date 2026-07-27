# OAuth Provider UI — Phase 2: Authorize Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the OAuth authorize flow — welcome, sign-in, sign-up, reset-password, consent, redirecting, reactivate — on shadcn/ui, replacing the `SmartForm`/`FormCard` render-prop engine with react-hook-form + zod.

**Architecture:** The forms layer is rebuilt first, because ~15 feature forms depend on it. A thin `FormShell` supplies the submit/cancel/back row, root-error rendering and pending state on top of shadcn's `ui/form`, so feature forms become plain `useForm` + zod schemas. Field wrappers then replace the `input-*` family. Only after the foundation is proven against the e2e suite do the individual screens migrate.

**Tech Stack:** React 19, react-hook-form 7, zod 3.24, `@hookform/resolvers` 3.10, shadcn/ui, Radix, Lingui, TanStack Router, Vitest.

**Spec:** [`../specs/2026-07-27-oauth-provider-ui-shadcn-redesign-design.md`](../specs/2026-07-27-oauth-provider-ui-shadcn-redesign-design.md)
**Predecessor:** [`2026-07-27-oauth-ui-phase-0-1-foundation-shell.md`](2026-07-27-oauth-ui-phase-0-1-foundation-shell.md) (complete)

## Global Constraints

Everything in the Phase 0–1 plan's Global Constraints still applies. Re-read it. The additions that matter most here:

- **Input `name` attributes owned by this package and asserted by the pds e2e suite:**
  `username`, `password`, `remember`, `code`, `email`, `handle`, `domain`, `inviteCode`.
  react-hook-form sets `name` from the field key — make the field keys match these
  exactly. (`identifier` in `oauth.test.ts` belongs to the demo client app, not us.)
- **Tag-specific assertions in this phase:** `h2` for `Mot de passe mis à jour !`
  (reset-password "password updated" view), `code` for `_atproto.<votre-domaine>`
  and `TXT` (custom-handle instructions), `h3` for `Avertissement` (already fixed),
  `p` for all unqualified body copy.
- **Button labels clicked by text** — all must remain real `<button>`s:
  `Suivant`, `Retour`, `Annuler`, `Valider`, `Vérifier`, `Se connecter`,
  `Créer un nouveau compte`, `Inscription`, `Oublié ?`, `Un autre compte`,
  `Se souvenir de ce compte sur cet appareil`, `Utiliser un nom de domaine que je possède`,
  `Autoriser`, `Plus tard`, `Envoyer le code de vérification`.
- **`scope-description.tsx` (942 lines) is the largest i18n risk in the package.**
  Copy every `<Trans>` block verbatim; restyle only the wrappers around them.
- **Run eslint from the repo root**, not the package — `.eslintrc`'s `import/resolver`
  project globs are root-relative.
- **Behaviour that must survive** (from the spec's table): typed OAuth error → message,
  request-code cooldown / rate-limit backoff, wizard back/forward with value retention,
  `lib/location-step.ts` URL-fragment sync, redirect double-submit guard,
  password strength scoring.

---

## Task Breakdown

### Task 1: `FormShell` — the react-hook-form replacement for `FormCard`/`SmartForm`

**Files:** create `src/components/forms/form-shell.tsx`, `src/components/forms/use-form-submit.ts`, `src/components/forms/use-form-submit.test.ts`

**Produces:**
- `FormShell` props: `{ form, onSubmit, submitLabel?, submitVariant?, onCancel?, cancelLabel?, onBack?, backLabel?, loading?, actions?, children }`. Renders shadcn `<Form>` + `<form>`, the action row of real `<button>`s, and root-error rendering via `ErrorNotice`.
- `useFormSubmit(form, handler)` — wraps a handler so thrown errors land on
  `form.setError('root', …)` through `errorToNotification`'s parser chain, and exposes
  `isSubmitting`. This is where the typed-OAuth-error behaviour is preserved.

TDD: `use-form-submit.test.ts` covers — success clears root error; a thrown
`OAuthErrorResponse` maps to the typed message; a plain `Error` maps to its message;
an aborted request does not set an error.

### Task 2: Field wrappers

**Files:** create `src/components/forms/fields/{text,email,password,new-password,token,handle,checkbox,radio-group}-field.tsx`; delete the corresponding `src/components/forms/input-*.tsx` as each last consumer migrates (deferred to Task 8 sweep).

Each wraps `FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage` + the shadcn
input primitive. **`name` is a required prop and is passed straight through.**
`new-password-field` keeps the strength meter on `ui/progress` fed by `lib/password.ts`.
`handle-field` composes `ui/input` + `ui/select` and keeps the `handle` / `domain` names.
`token-field` keeps `name="code"`.

Also: `request-code-button.tsx` (cooldown, on `use-rate-limited-action` + `use-countdown`),
`copy-button.tsx`, and migrate `input-token`/`sign-in-form` off `use-merged-refs`
(then delete that hook).

### Task 3: Auth layout

**Files:** create `src/components/layouts/auth-shell.tsx`; delete `src/components/layouts/layout-title.tsx`.

Replaces the split-panel `LayoutTitle` with a centred `Card`-based auth surface inside
`AppShell`. Must keep: the `<title>` render (`assertTitle('Se connecter')`), the title
as a heading, and the subtitle in a `<p>`.

### Task 4: Reset-password flow — the pilot migration

**Files:** `reset-password-view.tsx`, `reset-password-request-form.tsx`, `reset-password-confirm-form.tsx`.

Smallest flow that exercises the whole foundation: two forms, a three-view state machine,
`initialView`/`onViewChange` step restoration, `name="email"`, `name="code"`,
`name="password"`, and the `h2` assertion on `Mot de passe mis à jour !`.

**Gate:** run `packages/pds` `oauth.test.ts` here. Tasks 5–7 do not start until this
passes. If the foundation is wrong, this is where it shows up cheaply.

### Task 5: Sign-in

**Files:** `sign-in-view.tsx`, `sign-in-form.tsx`, `sign-in-picker.tsx`, `utils/account-card.tsx`.

Four `SignInView` variants (existing session / forced identifier / no sessions / picker)
all preserved. Keeps `name="username"`, `name="password"`, `name="remember"`, the
`Oublié ?` button, and the `Avertissement` `<h3>` notice. `AccountCard` rows keep their
`aria-label="Sign in as …"`.

### Task 6: Sign-up

**Files:** `sign-up-view.tsx`, `sign-up-wizard.tsx` (replacing `forms/wizard-card.tsx` + `use-stepper.ts`), `sign-up-handle-form.tsx`, `sign-up-credentials-form.tsx`, `sign-up-hcaptcha-form.tsx`, `sign-up-disclaimer.tsx`, `forms/input-handle-custom-instructions.tsx`.

Wizard keeps step order (handle → credentials → hcaptcha-if-configured), back/forward
with value retention, and the conditional hcaptcha step. Keeps `name="handle"`,
`name="domain"`, `name="email"`, `name="password"`, `name="inviteCode"`, and the
`<code>` elements in the custom-handle DNS instructions.

### Task 7: Consent, welcome, redirecting, reactivate

**Files:** `consent-view.tsx`, `consent-form.tsx`, `utils/scope-description.tsx`, `authenticate-welcome-view.tsx`, `redirecting-view.tsx`, `reactivate-account-view.tsx`, `utils/description-card.tsx`, `utils/help-card.tsx`, `utils/circular-progress.tsx`.

`scope-description.tsx` is restyle-only — its `<Trans>` blocks are copied verbatim.
`redirecting-view` keeps the cooldown and fallback link exactly as-is.

### Task 8: Phase 2 close-out

Dead-code sweep of `forms/input-*.tsx`, `form-card.tsx`, `smart-form.tsx`,
`form-context.tsx`, `form-field.tsx`, `fieldset-context.tsx`, `button*.tsx`,
`use-stepper.ts`, `use-merged-refs.ts`, `use-async-action` if unused.
Then `pnpm i18n` + French fill, both e2e suites vs baseline, and screenshots via the
mock dev server.

---

## Verification

Per task, from `packages/oauth/oauth-provider-ui`:

```bash
pnpm exec tsgo --build tsconfig.json
pnpm test
pnpm i18n && git diff src/locales/ | grep -E '^[+-]msgid'   # expect none unless intended
```

eslint from the repo root. E2E gate at Task 4 and Task 8:

```bash
cd packages/pds && pnpm test -- tests/oauth.test.ts
```

Visual check via `pnpm dev:ui` (port 5174, mocked — no dev-env needed).
