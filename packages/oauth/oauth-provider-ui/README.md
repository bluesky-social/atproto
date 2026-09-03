# @atproto/oauth-provider-ui

The sign-in, sign-up, consent and account-management screens served by a PDS
during OAuth. React 19, TanStack Router, Tailwind 4, shadcn on Base UI, Lingui.

This fork carries a redesign of these screens. The reasoning behind it is in
[DesignPrinciples.md](./DesignPrinciples.md); the engineering constraints
are in [CLAUDE.md](./CLAUDE.md).

## Screens

Captured from the mock dev server at 390×844 (2×). The background
illustration and the Bluesky branding are the mock's placeholders; a
deployment supplies its own through the provider's customization options.

### Signing in

<table>
  <tr>
    <td align="center"><img src="./docs/screenshots/picker.webp" width="220" alt="Account picker"><br><sub>Account picker</sub></td>
    <td align="center"><img src="./docs/screenshots/picker-light.webp" width="220" alt="Account picker, light"><br><sub>Account picker, light</sub></td>
    <td align="center"><img src="./docs/screenshots/sign-in.webp" width="220" alt="Sign in"><br><sub>Sign in</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="./docs/screenshots/sign-in-confirm.webp" width="220" alt="Confirm password"><br><sub>Confirm password</sub></td>
    <td align="center"><img src="./docs/screenshots/sign-in-2fa.webp" width="220" alt="2FA code"><br><sub>2FA code</sub></td>
    <td align="center"><img src="./docs/screenshots/sign-in-error.webp" width="220" alt="Wrong credentials"><br><sub>Wrong credentials</sub></td>
  </tr>
</table>

### Password reset and sign-up

<table>
  <tr>
    <td align="center"><img src="./docs/screenshots/forgot-password.webp" width="220" alt="Forgot password"><br><sub>Forgot password</sub></td>
    <td align="center"><img src="./docs/screenshots/reset-password.webp" width="220" alt="Reset code + new password"><br><sub>Reset code + new password</sub></td>
    <td align="center"><img src="./docs/screenshots/sign-up.webp" width="220" alt="Sign up, step 1"><br><sub>Sign up, step 1</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="./docs/screenshots/sign-up-2.webp" width="220" alt="Sign up, step 2"><br><sub>Sign up, step 2</sub></td>
    <td align="center"><img src="./docs/screenshots/sign-up-3.webp" width="220" alt="Sign up, captcha"><br><sub>Sign up, captcha</sub></td>
    <td align="center"><img src="./docs/screenshots/reactivate.webp" width="220" alt="Deactivated account"><br><sub>Deactivated account</sub></td>
  </tr>
</table>

### Consent and redirect

<table>
  <tr>
    <td align="center"><img src="./docs/screenshots/consent.webp" width="220" alt="Consent"><br><sub>Consent</sub></td>
    <td align="center"><img src="./docs/screenshots/consent-details.webp" width="220" alt="Technical details"><br><sub>Technical details</sub></td>
    <td align="center"><img src="./docs/screenshots/redirecting.webp" width="220" alt="Redirecting"><br><sub>Redirecting</sub></td>
  </tr>
</table>

### Errors

<table>
  <tr>
    <td align="center"><img src="./docs/screenshots/error.webp" width="220" alt="Error page"><br><sub>Error page</sub></td>
    <td align="center"><img src="./docs/screenshots/cookie-error.webp" width="220" alt="Cookie error"><br><sub>Cookie error</sub></td>
  </tr>
</table>

### Account management

<table>
  <tr>
    <td align="center"><img src="./docs/screenshots/account-home.webp" width="220" alt="Home"><br><sub>Home</sub></td>
    <td align="center"><img src="./docs/screenshots/account-manage.webp" width="220" alt="Settings"><br><sub>Settings</sub></td>
    <td align="center"><img src="./docs/screenshots/account-devices.webp" width="220" alt="Devices"><br><sub>Devices</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="./docs/screenshots/account-apps.webp" width="220" alt="Apps"><br><sub>Apps</sub></td>
  </tr>
</table>

On desktop the same pages sit beside a sidebar, at 1280×800:

<img src="./docs/screenshots/account-home-desktop.webp" width="720" alt="Account home on desktop">
<img src="./docs/screenshots/account-manage-desktop.webp" width="720" alt="Account settings on desktop">
<img src="./docs/screenshots/account-apps-desktop.webp" width="720" alt="Connected apps on desktop">

## Running the mock

```sh
pnpm install
pnpm run i18n:compile   # once, or after changing any string
pnpm dev:ui             # http://localhost:5174
```

Then open:

- `/authorization-page.html` — the OAuth flow: picker, sign-in, 2FA,
  password reset, sign-up, consent, redirect.
- `/account-page.html` — the account manager, every path under `/account`.
- `/error-page.html` and `/cookie-error-page.html`.

Everything runs against `src/mock-api.ts`; no PDS, no Docker. Sign in as any
listed account with any password. `matthieu.bsky.social` asks for a 2FA code
(`AAAAA-AAAAA`), `alice.test` is deactivated.

## Checking a change

```sh
pnpm exec tsc --build tsconfig.json
pnpm test
pnpm run i18n          # then check the msgid diff and fill every locale
```

Run eslint from the repository root, not from this package.
