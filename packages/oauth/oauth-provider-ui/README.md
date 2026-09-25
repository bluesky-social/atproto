# @atproto/oauth-provider-ui

The sign-in, sign-up, consent and account-management screens served by a PDS
during OAuth. React 19, TanStack Router, Tailwind 4, shadcn on Base UI, Lingui.

The design decisions behind these screens are in
[DesignPrinciples.md](./DesignPrinciples.md); the engineering constraints
are in [CLAUDE.md](./CLAUDE.md).

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
