# @atproto/oauth-provider-ui

The sign-in, sign-up, consent and account-management screens served by a PDS
during OAuth. React 19, TanStack Router, Tailwind 4, shadcn on Base UI, Lingui.

This fork carries the pckt.cafe redesign. The reasoning behind it is in
[DesignPrinciples.md](./DesignPrinciples.md); the engineering constraints
are in [CLAUDE.md](./CLAUDE.md).

## Screens

<table>
  <tr>
    <td align="center"><img src="./docs/screenshots/picker.webp" width="220" alt="Account picker"><br><sub>Account picker</sub></td>
    <td align="center"><img src="./docs/screenshots/sign-in.webp" width="220" alt="Sign in"><br><sub>Sign in</sub></td>
    <td align="center"><img src="./docs/screenshots/consent.webp" width="220" alt="Consent"><br><sub>Consent</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="./docs/screenshots/sign-up.webp" width="220" alt="Sign up"><br><sub>Sign up</sub></td>
    <td align="center"><img src="./docs/screenshots/error.webp" width="220" alt="Error page"><br><sub>Error page</sub></td>
    <td align="center"><img src="./docs/screenshots/account-manage.webp" width="220" alt="Account settings"><br><sub>Account settings</sub></td>
  </tr>
</table>

<img src="./docs/screenshots/account-home-desktop.webp" width="720" alt="Account home on desktop">

All captures are from the mock dev server at 390×844 (2×) in dark mode, and
1280×800 for the desktop one. The background illustration and the Bluesky
branding are the mock's placeholders; a deployment supplies its own through
the provider's customization options.

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
