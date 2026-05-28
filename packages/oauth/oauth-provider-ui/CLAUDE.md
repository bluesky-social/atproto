# oauth-provider-ui

UI for the OAuth provider's authorization & account-management screens. React 19, TanStack Router, Tailwind, Radix primitives, Lingui i18n.

## Verification

Type-check from the package directory only — root `pnpm verify:types` is fine but slow:

```bash
cd packages/oauth/oauth-provider-ui
pnpm exec tsc --build tsconfig.json
```

The hooks-driven IDE diagnostics surface prettier-tailwind class-ordering violations as errors. When the formatter reorders Tailwind classes, accept its order — don't argue with it.

## Component naming & composition

- `*-form.tsx` — pure form. Owns input state, emits a structured value via `onSubmit`, takes pending flags & cancel callbacks. No data fetching.
- `*-dialog.tsx` — Radix `Dialog` wrapper that takes a trigger child via `asChild`. Owns `open` state, optionally orchestrates multi-step flows. No data fetching.

## i18n (Lingui)

- `.po` files under `src/locales/*` are generated and reference source line numbers; deleting/renaming a component invalidates those references but extraction will refresh them — don't hand-edit.

## Forms

- Use `FormCardAsync` (in `components/forms/form-card-async.tsx`) for any submitted form. It owns loading/error state via `useAsyncAction`, exposes `submitLabel`, `onCancel`, `cancelLabel`, `invalid`, `disabled`, `append`. Don't reimplement.
- Validation: track field state in the form component, set `invalid` based on field validity. The submit button disables itself when `invalid` or `disabled` is set.
- `InputEmailAddress`, `InputToken`, `InputNewPassword`, `InputHandleProvided`, `InputHandleCustom` already exist — don't write new email/code/password inputs.
- `ButtonRequestCode` (and `ButtonCooldown` underneath) implements rate-limited resend buttons with a cooldown popover. Use it for any "resend code" action.

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

## Linting quirks

- ESLint requires unused vars/args to match `/^_/u`. Drop the destructure rather than prefixing with `_` when the prop is genuinely unused.
- Prettier's tailwind plugin will reorder classes. The IDE surfaces the violation; the fix is mechanical.
