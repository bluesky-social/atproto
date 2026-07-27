# oauth-provider-ui — shadcn redesign

**Date:** 2026-07-27
**Package:** `packages/oauth/oauth-provider-ui`
**Branch:** `oauth-provider-redesign`

## Goal

Rebuild the OAuth provider's UI on shadcn/ui with modern React patterns, keeping the
user-facing flows and journey intact. Existing component abstractions are not
preserved — this is a clean rebuild of the view layer, not a restyling.

## Non-goals

- Changing any user-visible string. See [Constraint: i18n](#constraint-i18n).
- Changing the OAuth protocol surface, the `~api` endpoints, or
  `@atproto/oauth-provider-api` types.
- Adding runtime dependencies to the published package. Everything new is a
  `devDependency`; Vite bundles it.
- Wiring branding colors. The neutral theme lands first; branding is layered in
  afterwards as a separate change.

## Scope

| | |
|---|---|
| Component source rebuilt | ~8,700 lines across ~90 files |
| Entry pages | 4 (`authorization-page`, `account-page`, `error-page`, `cookie-error-page`) |
| Routes | 10 |
| Messages × locales | 346 × 6 (en, es, fr, ja, ko, sv) |

---

## Constraints

### Constraint: i18n

Lingui is configured without explicit message IDs (`.linguirc` has no `runtimeConfigModule`
override and the catalogs use source text as `msgid`). Every `msgid` in
`src/locales/*/messages.po` **is** the English source string, and `<Trans>` placeholders are
positional (`<0>`, `<1>`, …) derived from the JSX element nesting inside the macro.

Therefore:

1. **No user-visible string may change.** Not punctuation, not capitalization,
   not whitespace inside a `<Trans>` body.
2. **JSX structure inside a `<Trans>` body may not change.** Adding, removing, or
   reordering a child element renumbers the placeholders, producing a new `msgid`
   and silently orphaning the translation in all 5 non-English locales.
3. `msg({ message, context })` calls must keep their `context` value — it is part
   of the catalog key (e.g. `msg({ message: 'Sign in', context: 'AuthenticationPage' })`,
   `<Trans context="verify email">`).

Recompose *around* `<Trans>` blocks. When a `<Trans>` block needs different visual
treatment, style the element the macro already wraps rather than introducing a new one
inside it.

After each phase, run `pnpm i18n` from the package directory, then fill in French
translations for any newly extracted entry (French only — the other locales are
translated externally), then re-run `pnpm i18n`. A phase is not done until
`git diff src/locales/*/messages.po` shows only line-reference churn, no
added/removed `msgid`s beyond those deliberately introduced.

### Constraint: e2e tests

`packages/pds/tests/oauth.test.ts` and `packages/pds/tests/account-manager.test.ts` drive
this UI through `PageHelper` (`packages/pds/tests/_puppeteer.ts`). Its selectors are
text-and-tag based:

| Helper | Depends on |
|---|---|
| `clickOnText(text, tag = 'button')` | Action is a real `<button>` containing that exact text |
| `clickOnAriaLabel(label, tag = 'button')` | `aria-label` on a `<button>` |
| `typeInInput(name, text)` | `input[name="…"]` |
| `ensureTextVisibility(text, tag = 'p')` | Body copy rendered inside a `<p>` |
| `ensureNotification(text)` | Toast text present in the DOM |
| `assertTitle(expected)` | `document.title` |
| `navigationClick(text, tag = 'button')` | Click causes a navigation |

The rebuild must therefore preserve:

- `name` attributes on every input the tests type into.
- Real `<button>` elements for actions (not `<a>`, not `<div role="button">`).
  shadcn's `Button` with `asChild` renders whatever child it is given — keep it a
  `<button>` for anything the tests click.
- Body copy inside `<p>`. shadcn's `CardDescription` and `AlertDescription` render
  `<p>`, so this falls out naturally; `CardTitle` renders a `<div>` and must not be
  the only home for asserted copy.
- `aria-label`s and the `<title>` renders currently in `LayoutApp` / `LayoutPage`.
- Toast text reachable in the DOM after the Sonner swap.

**Baseline first.** Before any code changes, run both suites on the current tree and
record the result. Any later failure is then attributable. Changes to these test files
are permitted but each one must be justified as an intentional UX change, not absorbed
silently.

### Constraint: branding

Per decision, the customization contract is unchanged:

- `CustomizationProvider` / `useCustomizationData` stay.
- Logo, name, and footer links stay in the app chrome (`LayoutApp`).
- `availableUserDomains`, `hcaptchaSiteKey`, `inviteCodeRequired`, `links` stay —
  sign-in and sign-up depend on them.
- `packages/oauth/oauth-provider/src/customization/build-customization-css.ts` is
  **not modified**. The server keeps injecting `--branding-color-*`; the new theme
  simply does not consume those variables yet.

Only the *color derivation* goes: `src/style.css` drops the
`--branding-color-* → --color-primary-{25..975} / --color-contrast-{0..1000}` scale
machinery in favor of shadcn's fixed neutral token set. Layering branding back in later
is then a change confined to that one file.

---

## Architecture

### Kept as-is

Non-view layers are untouched:

- `src/lib/` — `api.ts`, `json-client.ts`, `api-error-parser.ts`, `error-parser.ts`,
  `cookies.ts`, `handle.ts`, `password.ts`, `util.ts`, `lang.ts`, `oauth-client.ts`,
  `location-step.ts` (+ `location-step.test.ts`)
- `src/data/` — the react-query hooks (`account`, `account-sessions`, `oauth-sessions`,
  `email`, `handle`, `password`)
- `src/contexts/` — `session.tsx`, `authentication.tsx`, `customization.tsx`
  (`notifications.tsx` keeps its `notify` / `notifyError` API but changes implementation)
- `src/locales/` — catalogs, loader, provider
- Logic hooks — `use-countdown`, `use-date-ago`, `use-browser-name`,
  `use-browser-color-scheme`, `use-oauth-client-identifier`, `use-oauth-client-name`,
  `use-async-action`, `use-rate-limited-action`, `use-stable-callback`, `use-random-string`

### Rebuilt from zero

- All of `src/components/**`
- All route components under `src/pages/**`. The **route tree and paths are preserved**
  (`buildRoutes`, `DEFAULT_PAGES` positions/titles/icons, the `customPages` extension
  point) — only their rendering is rewritten.
- The 4 entry pages.

### Deleted

- `src/hooks/use-click-outside.ts`, `use-escape-key.ts`, `use-merged-refs.ts` — Radix
  primitives handle dismissal, focus, and ref composition.
- `src/components/utils/palette.tsx` and the `/branding` demo route in
  `src/pages/router.tsx` that exists only to render it. The `customPages` mechanism
  itself is kept; the example page goes.

### Behavior that must survive the abstraction change

The old `SmartForm` / `FormCard` / `Button*` stack carries behavior, not just shape.
Reimplement each of these idiomatically rather than dropping them:

| Behavior | Currently in | New home |
|---|---|---|
| Typed OAuth error → user-facing message | `FormCard` `errorParser` + `lib/api-error-parser.ts` | Shared `useFormErrorHandler` mapping caught errors onto `form.setError('root')` |
| Request-code cooldown / rate-limit backoff | `button-cooldown.tsx`, `button-request-code.tsx`, `use-rate-limited-action` | Dedicated `RequestCodeButton` on shadcn `Button` + existing hooks |
| Multi-step wizard back/forward with value retention | `wizard-card.tsx`, `use-stepper.ts` | `SignUpWizard` — retained (no shadcn equivalent), rebuilt on `Card` + a step indicator |
| Authorize-flow step ↔ URL fragment sync | `lib/location-step.ts` | Unchanged |
| Redirect double-submit guard + fallback link | `authorization-page.tsx`, `redirecting-view.tsx` | Unchanged logic, new presentation |
| Password strength scoring | `lib/password.ts` + meter/label components | `lib/password.ts` unchanged; meter rebuilt on shadcn `Progress` |
| Async submit pending state | `use-async-action` | react-hook-form `formState.isSubmitting`. `use-async-action` is retained for non-form async actions (dialog confirmations, standalone buttons) |

---

## Design system foundation

### Dependencies (all `devDependencies`)

Added: `class-variance-authority`, `tailwind-merge`, `lucide-react`, `react-hook-form`,
`@hookform/resolvers`, `sonner`, `tw-animate-css`, plus the Radix primitives each
generated shadcn component pulls in (`react-slot`, `react-label`, `react-checkbox`,
`react-radio-group`, `react-select`, `react-dropdown-menu`, `react-separator`,
`react-progress`, `react-avatar`, `react-tooltip`).

Removed: `@radix-ui/react-toast` (→ Sonner), `@phosphor-icons/react` (→ Lucide),
`@radix-ui/react-compose-refs` (→ `Slot`).

Retained: `clsx` (used by `cn`), `zod` (v3, works with `@hookform/resolvers`),
`@radix-ui/primitive`, `@radix-ui/react-dialog`, `@radix-ui/react-popover`,
`@hcaptcha/react-hcaptcha`, `@tanstack/react-router`, `@tanstack/react-query`,
`ua-parser-js`, `@tailwindcss/typography`.

### Configuration

- `components.json` at the package root, `style: "new-york"`, `baseColor: "neutral"`,
  `rsc: false`, `tsx: true`, `cssVariables: true`.
- Path alias stays `#/` (Node subpath imports, already wired in `package.json` and
  `vite.config.mjs`). `components.json` aliases point at `#/components`, `#/lib/utils`,
  etc. shadcn CLI output is adjusted from `@/` to `#/` on generation.
- `src/lib/utils.ts` exports `cn(...inputs)` = `twMerge(clsx(inputs))`.
- `Override<A, B>` from `src/lib/util.ts` is retained as the prop-extension idiom.

### Tokens and theming

**The legacy scale is additive-then-removed, not replaced up front.** Every existing
component styles itself with `text-text-default`, `text-text-light`, `bg-contrast-0`,
`border-contrast-25`, `bg-primary-500`, `border-error-200`, etc. Deleting those tokens in
Phase 0 would break the entire UI for the three phases it takes to migrate off them. So
Phase 0 *adds* the shadcn token block alongside the existing `--branding-color-*` scale;
the legacy block, the `@source inline(...)` directives, and the `<body>` class change all
land together in Phase 4's dead-code sweep, once nothing consumes them. The two token
systems coexist for phases 1–3, which costs a few KB of unused CSS during the migration
and nothing after.

At close-out `src/style.css` is the standard shadcn block: `@import 'tailwindcss'`,
`@import 'tw-animate-css'`, `@theme inline` mapping shadcn's semantic names, and
`:root` / dark overrides on the `neutral` base — `background`, `foreground`, `card`,
`popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`,
`ring`, plus `--radius`.

**Dark mode** uses `@custom-variant dark (@media (prefers-color-scheme: dark))` rather
than shadcn's default `.dark` class selector. This matches current behavior exactly:
system-driven, no toggle, no persisted preference, no flash-of-wrong-theme. Introducing
a theme switcher is out of scope.

The `@source inline("text-text-default")` / `@source inline("bg-contrast-0")` directives
exist because `<body class="text-text-default bg-contrast-0">` is set outside the Vite
build, in five places:

- `packages/oauth/oauth-provider/src/router/assets/assets.ts:114` (`bodyAttrs`, production)
- `packages/oauth/oauth-provider-ui/{authorization,account,error,cookie-error}-page.html`
  (dev templates)

**Phase 4** changes all five to `text-foreground bg-background` and updates the two
`@source inline(...)` directives to match — deferred to close-out because the legacy
tokens must keep working while phases 1–3 migrate off them. This is the one deliberate
edit to the `oauth-provider` package; it is a single line and does not touch
`build-customization-css.ts` or the branding contract.

---

## Component mapping

### Primitives → `src/components/ui/*` (shadcn-generated)

`button`, `input`, `label`, `form`, `card`, `dialog`, `alert`, `checkbox`,
`radio-group`, `select`, `dropdown-menu`, `separator`, `progress`, `avatar`,
`skeleton`, `sonner`, `tooltip`, `popover`, `badge`.

### Old → new

| Old | New |
|---|---|
| `forms/button.tsx`, `button-async.tsx` | `ui/button` + rhf `isSubmitting` |
| `forms/button-cooldown.tsx`, `button-request-code.tsx` | `request-code-button.tsx` on `ui/button` |
| `forms/button-copy.tsx` | `copy-button.tsx` on `ui/button` |
| `forms/button-toggle-visibility.tsx` | Inline adornment in `password-field.tsx` |
| `forms/form-card.tsx`, `smart-form.tsx`, `form-context.tsx`, `form-field.tsx`, `fieldset-context.tsx` | `ui/form` (react-hook-form) + per-form zod schemas |
| `forms/input-container.tsx`, `input-text.tsx` | `ui/input` + `ui/form` field wiring |
| `forms/input-email-address.tsx` | `email-field.tsx` |
| `forms/input-password.tsx`, `input-new-password.tsx` | `password-field.tsx`, `new-password-field.tsx` |
| `forms/input-token.tsx` | `token-field.tsx` |
| `forms/input-handle-default.tsx` | `handle-field.tsx` — `ui/input` + `ui/select` for the domain |
| `forms/input-handle-custom.tsx`, `input-handle-custom-instructions.tsx` | `custom-handle-field.tsx`, `custom-handle-instructions.tsx` |
| `forms/input-checkbox.tsx`, `checkbox.tsx` | `ui/checkbox` + `ui/form` |
| `forms/input-radio-group.tsx` | `ui/radio-group` |
| `forms/wizard-card.tsx` + `use-stepper.ts` | `sign-up-wizard.tsx` on `ui/card` + step indicator |
| `utils/admonition.tsx` (204 lines) | `ui/alert` variants |
| `utils/error-card.tsx`, `error-details.tsx` | `ui/alert` destructive + `error-details.tsx` |
| `utils/description-card.tsx`, `help-card.tsx`, `account-card.tsx` | `ui/card` compositions |
| `utils/dialog-simple.tsx` | `ui/dialog` |
| `utils/account-selector.tsx` | `ui/dropdown-menu` |
| `utils/account-image.tsx`, `client-image.tsx` | `ui/avatar` |
| `utils/password-strength-meter.tsx`, `password-strength-label.tsx` | `ui/progress` + label |
| `utils/circular-progress.tsx` | Retained (cooldown indicator; no shadcn equivalent) |
| `utils/code-snippet.tsx`, `url-viewer.tsx`, `handle.tsx`, `date-ago.tsx`, `lang-string.tsx`, `link-*.tsx`, `account-name.tsx`, `account-identifier.tsx`, `account-overview.tsx`, `client-name.tsx`, `icons.tsx` | Rebuilt, mostly presentational; `icons.tsx` re-sourced from Lucide |
| `utils/scope-description.tsx` (942 lines) | Rebuilt on `ui/card`/`ui/alert`. **Trans blocks copied verbatim** — this file is the largest i18n risk in the package |
| `layouts/layout-app.tsx` | `layouts/app-shell.tsx` — header (logo/name), content, footer (locale selector + links) |
| `layouts/layout-page.tsx` | `layouts/account-shell.tsx` — shadcn Sidebar block |
| `layouts/layout-title.tsx` | Folded into the auth `Card` header |
| `contexts/notifications.tsx` (Radix Toast) | Same API, Sonner `toast()` underneath |
| `locales/locale-selector.tsx` | `ui/select` |

### Sidebar change

`LayoutPage` currently implements a bespoke mobile pattern: at the base route the nav
link list *is* the page; on a sub-route the content replaces it with a back arrow. The
rebuild uses shadcn's Sidebar block — persistent rail on desktop, Sheet on mobile.

This is the single largest UX change in the redesign. Flows and destinations are
identical; the navigation model differs. Nav links keep their text, so
`clickOnText(text, 'a')`-style assertions survive, but the mobile back-arrow
(`clickOnAriaLabel`) disappears and any test relying on it needs updating.

---

## Flow inventory

Every screen below must exist after the rebuild. This is the checklist for "flows intact".

### Authorization page (`authorization-page.tsx`)

No router by design — view changes must not create history entries. Step is mirrored to
the URL fragment via `lib/location-step.ts` (`AUTH_STEPS`: `welcome`, `sign-in`,
`sign-up`, `reset-password`, `reset-password-confirm`, `consent`).

1. **Welcome** — Create a new account / Sign in / Cancel
2. **Sign in**, four variants driven by `SignInView`:
   - existing `session` → confirm password, username readonly
   - `forcedIdentifier` (login hint) → enter password, username readonly
   - no stored sessions → full username + password form
   - stored sessions → **account picker**, with "other account" escape to the form
3. **Sign up wizard** (`SignUpView`), steps conditional on customization:
   - Choose a username (validated against the server before advancing)
   - Your account (email, password, invite code if `inviteCodeRequired`)
   - Verify you are human (only if `hcaptchaSiteKey` is set)
4. **Reset password** (`ResetPasswordView`), three sub-views: Request reset →
   Confirm reset (code + new password) → Password updated. Includes the
   "Already have a code?" jump from request to confirm, and `initialView` /
   `onViewChange` so a refresh restores the confirm sub-step.
5. **Reactivate account gate** — shown when `session.account.deactivated`; cancel
   either rejects consent (login-hint case) or returns to account selection
6. **Consent** — client identity, trusted/first-party treatment, permission set
   details, scope descriptions, accept / reject / back
7. **Redirecting** — cooldown, then `location.replace`, with a fallback link.
   Titles differ for accept (`Sign-in complete`) vs reject (`Sign-in canceled`)
8. **Error boundary** → `ErrorView`

### Account page (`account-page.tsx`)

Route tree via `buildRoutes('/account', customPages)`; positions and titles preserved.

- `/account` — Home (index)
- `/account/manage` — Account. Sections: email (+ unverified admonition and
  Verify-now dialog), password, username, reactivate/deactivate, delete
- `/account/devices` — Devices / active sessions
- `/account/apps` — Connected OAuth apps, with a session-details dialog
- `/account/about` — About (has a French-specific variant, `page.fr.tsx`)
- `/account/reset-password` — unauthenticated reset flow
- Popup/webview mode: `display=popup`, `login_hint`, `nonce`, `redirect_uri`
  handling in `AuthGate` — unchanged

Dialogs (8): verify-email, update-email, update-password, update-handle,
reactivate-account, deactivate-account, delete-account, oauth-session-details.

### Standalone pages

- `error-page.tsx`
- `cookie-error-page.tsx`

---

## Phasing

Each phase leaves the app bootable and type-clean. Old components are deleted as their
last consumer migrates, so no parallel tree and no feature flag.

**Phase 0 — Foundation.** Dependencies, `components.json`, `src/lib/utils.ts`, the
shadcn token block *added alongside* the legacy scale, dark-mode variant,
`components/ui/*` authored. Purely additive — the app still renders on old components,
unchanged.

**Phase 1 — Shell.** `app-shell`, `account-shell` (Sidebar), Sonner swap, locale
selector, account/client identity components, the Alert/Card vocabulary. Phosphor →
Lucide across the tree.

**Phase 2 — Authorize flow.** Welcome, sign-in + picker, sign-up wizard, consent
(including `scope-description`), redirecting, reactivate, reset-password. Highest-risk
phase: most i18n surface, most e2e coverage.

**Phase 3 — Account manager.** Index, manage, devices, apps, about, and all 8 dialogs.

**Phase 4 — Close-out.** Error and cookie-error pages; dead-code sweep including the
legacy token block, the `@source inline(...)` directives, and the `<body>` class change
in `assets.ts` + the 4 dev HTML templates; final `pnpm i18n` + French fill; e2e
reconciliation against the Phase-0 baseline; and a rewritten
`packages/oauth/oauth-provider-ui/CLAUDE.md` — the current one documents
`SmartForm`/`FormCard`/`input-*` conventions that will no longer exist.

---

## Verification

Per phase:

```bash
cd packages/oauth/oauth-provider-ui
pnpm exec tsgo --build tsconfig.json   # type check
pnpm test                              # vitest (location-step)
pnpm i18n                              # then inspect .po diff
```

Plus a browser walkthrough of the phase's screens via the `playwright` skill against
`make run-dev-env`, at both desktop and 390px widths.

At close-out:

```bash
cd packages/pds && pnpm test tests/oauth.test.ts tests/account-manager.test.ts
```

compared against the Phase-0 baseline.

Note: `make run-dev-env` needs ports 2582/2583 free — stop the local switchback docker
stack first.

## Risks

| Risk | Mitigation |
|---|---|
| Silent translation loss from restructured `<Trans>` bodies | Treat `<Trans>` blocks as opaque; assert on the `.po` diff every phase |
| `scope-description.tsx` (942 lines, dense i18n) regressing the consent screen | Copy Trans blocks verbatim; restyle only the wrappers |
| e2e drift attributed to the wrong change | Capture a green baseline before Phase 0 |
| Sidebar change breaking mobile navigation assertions | Expected; update those specific assertions with justification |
| `<body>` classes set server-side by the provider referencing removed tokens | Reconciled explicitly in Phase 0 |
| shadcn CLI emitting `@/` imports against this package's `#/` alias | Adjust on generation; `components.json` aliases set up front |
