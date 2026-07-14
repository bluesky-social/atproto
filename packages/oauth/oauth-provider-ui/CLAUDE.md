# oauth-provider-ui

UI for the OAuth provider's authorization & account-management screens. React 19, TanStack Router, Tailwind, Radix primitives, Lingui i18n.

## Verification

Type-check from the package directory only — root `pnpm verify:types` is fine but slow:

```bash
cd packages/oauth/oauth-provider-ui
pnpm exec tsgo --build tsconfig.json
```

The hooks-driven IDE diagnostics surface prettier-tailwind class-ordering violations as errors. When the formatter reorders Tailwind classes, accept its order — don't argue with it.

## Component naming & composition

Everything under [src/components/](src/components/) is expected to be **pure** — driven by props, free of business logic and app-specific endpoints. No `useQuery`/`useMutation` against API clients, no `useSessionContext`/`useAuthenticationContext` reads, no direct calls into `#/lib/api.ts`. State is allowed (open flags, multi-step wizards, controlled inputs) as long as it's UI state, not domain state.

The boundary works as a layered stack:

1. **Low-level pure components** — `forms/*`, `utils/*`, `layouts/*`. Inputs, buttons, dialogs primitives, layout shells.
2. **High-level pure components** — `*-form.tsx`, `*-dialog.tsx`, `*-view.tsx`. Compose the low-level pieces into a feature surface and expose callbacks (`onSignIn`, `onConsent`, `onUpdateEmail`, …) for the parent to wire up.
3. **Pages** — entry points under [src/](src/) (e.g. [authorization-page.tsx](src/authorization-page.tsx), [account-page.tsx](src/account-page.tsx)) and the route components under [src/pages/](src/pages/). These are the _only_ layer that pulls in contexts (`useSessionContext`, `useAuthenticationContext`, …), TanStack Query, the API client, and routing. They translate domain state into props and callbacks for the components in step 2.

For example, [authorization-page.tsx](src/authorization-page.tsx) reads `useSessionContext()` and threads `session.account`, `api.myMethod()` into a pure `<ConsentView>`; the `ConsentView` itself never knows the session context exists. Same shape for the router-driven pages in [account-page.tsx](src/account-page.tsx) — each route component pulls business logic from contexts and renders pure components.

When unsure where to add a piece of code: if it imports from `#/contexts/*`, an API client, or a router hook, it belongs in `src/pages/` or one of the top-level `*-page.tsx` files — not in `src/components/`.

- `*-form.tsx` — pure form. Owns input state, emits a structured value via `onSubmit`, takes pending flags & cancel callbacks. No data fetching.
- `*-dialog.tsx` — Radix `Dialog` wrapper that takes a trigger child via `asChild`. Owns `open` state, optionally orchestrates multi-step flows. No data fetching.
- `*-view.tsx` — page-level composition of forms/dialogs/layout. Still pure: receives the data it needs as props and emits callbacks.

## i18n (Lingui)

- `.po` files under `src/locales/*` are generated and reference source line numbers; deleting/renaming a component invalidates those references but extraction will refresh them — don't hand-edit.
- After any edit to a `.tsx` file in this package, run `pnpm i18n` from the package directory. This re-extracts the message catalogs and rebuilds them — both source-line references and any newly-introduced `<Trans>` / ``t`...` `` strings get picked up.
- After `pnpm i18n`, fill in the **French** translations (only) for any newly-extracted entries in [src/locales/fr/messages.po](src/locales/fr/messages.po) — leave every other locale's `.po` file untouched (those are translated externally). Then re-run `pnpm i18n` so [src/locales/fr/messages.ts](src/locales/fr/messages.ts) reflects the new strings.

## Forms

Three layers of primitives live under [src/components/forms/](src/components/forms/). Pick the highest-level one that fits — don't reach for `FormCard` directly when `SmartForm` would do.

- **`FormCard`** — the lowest-level primitive. Renders a `<form>` with the standard submit / cancel / back button row, error rendering, and a `disabled`/`loading`/`submittable` context. It does NOT track any state — the caller owns inputs, validity, and submit handling. In practice it is only consumed by `SmartForm`; feature components import `FormCardProps` for prop forwarding (e.g. [sign-in-form.tsx](src/components/sign-in-form.tsx)) but should not render `<FormCard>` directly.

- **`SmartForm<TData, TValues>`** — `FormCard` + full controlled state. Caller provides `values` (initial), `validate(values) → TData | undefined` (also gates submit — returning `undefined` disables the submit button), and `handler(data, signal)`. The `fields` render-prop receives `{ values, set, setterFor, loading, error, data }` for wiring inputs. Pass a `ref` to expose the same handler imperatively when a parent needs to mutate fields (e.g. clearing the OTP field on credential change in [sign-in-form.tsx](src/components/sign-in-form.tsx)). This is the default for new forms — most `*-form.tsx` components are thin `SmartForm` wrappers (see [reset-password-request-form.tsx](src/components/reset-password-request-form.tsx) for the minimal shape).

When authoring a `SmartForm`-based component, type its props as `WrappedSmartFormProps<TData>` (also exported from `smart-form.tsx`) — that omits `fields` and `validate` so callers only pass the outer `FormCard` props plus any feature-specific extras.

**`*-form.tsx` MUST be built on `SmartForm`** — never hand-roll `<form>` + `useAsyncAction` + `useState` even when the form has unusual extras (extra inputs, a resend button, custom error rendering, an error-colored submit). Pass-throughs that already exist on `FormCardProps` cover almost every case:

- Custom submit label or color: `submitLabel` / pass through `submitColor` (or override the row via `actions`).
- Cancel / back: `onCancel` + `cancelLabel`, `onBack` + `backLabel` — the parent dialog/page provides them.
- Wider button styling (e.g. stacked full-width buttons): supply your own row via `actions` and set `submitLabel={null}` if needed; do NOT rebuild the form to get a different layout.
- Extra pending state from outside the form (e.g. an in-flight resend): merge it into `props.loading` (`loading={props.loading || requestPending}`).
- Error display: `FormCard` already renders `error` via `errorRender` / `errorParser` — don't call `errorCardRender` yourself.
- Loading-state mirroring to the parent: pass `onLoadingChange` straight through (it's a `SmartFormProps` prop already).

If a constraint genuinely cannot be expressed through these props, extend `FormCard`/`SmartForm` itself rather than forking the form. See [reset-password-confirm-form.tsx](src/components/reset-password-confirm-form.tsx) and [update-email-form.tsx](src/components/update-email-form.tsx) for the canonical shapes — including a form that already mixes a SmartForm with a `ButtonRequestCode` resend link inside the `fields` render-prop.

## Input components (`input-*.tsx`)

Low-level input wrappers (`InputText`, `InputEmailAddress`, `InputPassword`, `InputToken`, `InputHandleCustom`, `InputCheckbox`, …) are thin layers over a native `<input>`. They MUST NOT force the input into controlled or uncontrolled mode — pass both `value` and `defaultValue` straight through to the underlying `<input>` (typically by spreading `...props` into `InputText`) and let the parent pick.

Adding internal `useState` to mirror `value`/`defaultValue` so the wrapper can re-render is the anti-pattern. If you need a derived UI element that depends on the live value (e.g. a strength meter, a character counter), it is fine to keep a _separate_ internal state seeded from `props.defaultValue ?? props.value` and updated via the `onChange` handler — but the `<input>` itself still reads `value`/`defaultValue` from the parent's props, not from that internal state. See [input-new-password.tsx](src/components/forms/input-new-password.tsx) for the canonical shape (the local `current` drives the strength meter; the input remains controllable by the parent).

Higher-level semantic callbacks (`onEmail`, `onPassword`, `onToken`, `onHandle`, …) are encouraged on top of `onChange`. Implement them by composing with the user-supplied `onChange` (use `composeEventHandlers` from `@radix-ui/primitive`) and emitting the parsed/validated value — `undefined`/`null` when the input is not yet valid. This is typically used with uncontrolled mode (with the initial value being passed as `defaultValue`). See [input-email-address.tsx](src/components/forms/input-email-address.tsx) and [input-token.tsx](src/components/forms/input-token.tsx) for the pattern.

Exception: components that compose a single logical value out of multiple native inputs (e.g. [input-handle-default.tsx](src/components/forms/input-handle-default.tsx) splits the handle into a text segment + a domain `<select>`) can't pass `value`/`defaultValue` straight through and may legitimately own internal state. They expose only the high-level pair (`handle` + `onHandle`) instead.

## Utility types

`Override<A, B>` (from `#/lib/util.ts`) is the standard prop-extension pattern across the package:

```tsx
type Props = Override<
  JSX.IntrinsicElements['button'],
  { icon: Icon; value?: ReactNode }
>
```

Phosphor icons are typed as `Icon` (the exported type), not `ComponentType<IconProps>`.

## Tailwind

- Class strings are scanned statically. When picking classes from a variable (e.g. column counts), use a literal-string lookup table so all candidates are present in the source.
- The `disabled:hover:bg-transparent` / `disabled:cursor-default` pair is the convention for non-interactive button rows.
- `text-text-default` / `text-text-light` and `border-contrast-25` / `border-contrast-50` are the tokens — don't introduce raw slate/gray utilities for content.

## API client ([src/lib/api.ts](src/lib/api.ts))

`Api` extends `JsonClient<ApiEndpoints>` and is the single seam between the UI and the OAuth provider's `~api` endpoints. Three rules apply when adding or modifying an endpoint:

1. **One method per endpoint.** Every endpoint gets its own `async` method on `Api` — pages and `data/*` hooks never call `this.fetch` directly. The method takes the typed input as the first argument and an optional `options?: Options` (for `AbortSignal`, etc.) as the second, forwarded to `this.fetch(method, path, body, options)`.

2. **Destructure and rebuild the payload.** Pull each field out of the input by name and pass a fresh object literal to `fetch` — never spread the input. Inputs are typed against `@atproto/oauth-provider-api` and callers may pass values that _extend_ the declared type (extra UI-only fields, derived state); spreading would forward those over the wire and the server would reject them. For inputs with a `locale` field, wrap the type in `WithOptionalLocale<T>` and default to `this.locale` during destructuring (`locale = this.locale`) so callers can omit it.

3. **Register expected error payloads in `parseError`.** When the server adds a new typed error response, define the payload type and an `OAuthErrorResponse` subclass with a static `is(json)` discriminator alongside the existing ones, then add add it to the list of Error classes in the `parseError` method.

## Linting quirks

- ESLint requires unused vars/args to match `/^_/u`. Drop the destructure rather than prefixing with `_` when the prop is genuinely unused.
- Prettier's tailwind plugin will reorder classes. The IDE surfaces the violation; the fix is mechanical.
