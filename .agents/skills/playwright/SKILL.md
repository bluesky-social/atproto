---
name: playwright
description: >
  Drive and inspect this repo's OAuth provider UI and Account Manager (source in
  packages/oauth/oauth-provider-ui, served by the PDS at /account). Use when
  writing or extending the puppeteer-based UI tests in packages/pds/tests
  (oauth.test.ts, account-manager.test.ts), when you need the exact visible
  label, heading, or error string a screen renders before asserting on it, when
  demoing, navigating or debugging an OAuth sign-in / sign-up / consent flow
  locally or against production, when exercising account management (password,
  email, handle, device sessions, deactivation, deletion), or when a question
  about behavior can only be answered from the rendered page. Use it even when
  the request sounds like plain test-writing ("add a test for the reset-password
  error case") — getting the assertion strings right is the whole problem.
disable-model-invocation: false
---

# OAuth & Account Manager UI

The UI lives in [`packages/oauth/oauth-provider-ui`](../../../packages/oauth/oauth-provider-ui) (React 19, TanStack Router, Radix, Lingui i18n) and is served by the PDS through the OAuth provider's middleware. That package has its own [CLAUDE.md](../../../packages/oauth/oauth-provider-ui/CLAUDE.md) covering component structure and i18n — read it before editing the UI itself.

There is **no Playwright test harness in this repo**: no `playwright` / `@playwright/test` dependency, no `playwright.config.*`, no `.spec.ts` files. The browser tests are jest + **puppeteer** (`puppeteer` is a devDependency of `packages/pds` only). "Playwright" in this skill's name refers to driving a browser interactively for discovery and debugging, not to the test runner.

## Get the strings without a browser first

The tests assert **French** strings, because they set `languages = ['fr-BE', 'fr', 'en-US', 'en']` to exercise locale negotiation. Booting a stack and spoofing a locale just to read a label is slow and easy to get wrong. Two faster sources:

1. **The message catalog** — [`packages/oauth/oauth-provider-ui/src/locales/fr/messages.po`](../../../packages/oauth/oauth-provider-ui/src/locales/fr/messages.po) maps every source string to its French translation, with the defining component in a `#:` comment above it. Grep it for the English string you saw in the JSX and you have the exact assertion text.

   ```
   #: src/pages/account/(authenticated)/route.tsx
   msgid "My Atmosphere Account"
   msgstr "Mon compte Atmosphère"
   ```

   Watch for `msgctxt` — the same English word can have several entries (`"Sign in"` under `msgctxt "verb"` is `"Se connecter"`; the noun form differs).

2. **The mock UI dev server** — renders the real components against a fake API, so no PDS, postgres, redis, or docker is involved:

   ```sh
   cd packages/oauth/oauth-provider-ui
   pnpm dev:ui   # http://localhost:5174
   ```

   Pages: `/account-page.html`, `/authorization-page.html`, `/error-page.html`, `/cookie-error-page.html`. Fixtures (accounts, device sessions, branding) are in [`src/mock-api.ts`](../../../packages/oauth/oauth-provider-ui/src/mock-api.ts) — edit them to reach a state the real backend makes awkward (deactivated account, unverified email, many device sessions). It renders in your browser's own locale, so use it for layout and flow, and the `.po` file for the exact French text.

Boot the full stack only when you need real backend behavior: token issuance, email tokens, PLC propagation, handle resolution, deactivation side effects.

## Booting the real stack

`packages/dev-env` wraps startup in [`with-test-redis-and-db.sh`](../../../packages/dev-infra/with-test-redis-and-db.sh), which needs **docker** and **jq** (it falls back to a native postgres/redis if docker is unavailable). Build first — it runs the compiled `dist/bin.js`, not the sources:

```sh
pnpm install && pnpm build       # once, from the repo root
cd packages/dev-env && pnpm dev  # PDS on :2583, PLC on :2582, appview on :2584
```

Run `pnpm dev:ts` from the root in another terminal if you're editing TypeScript alongside.

- Account Manager: `http://localhost:2583/account`
- Seeded accounts ([`packages/dev-env/src/mock/index.ts`](../../../packages/dev-env/src/mock/index.ts)): `alice.test`, `bob.test`, `carla.test`, all `hunter2`.
- Setting `NODE_ENV=development` (which `pnpm dev` does) makes the OAuth provider log server-side errors and include stack traces in error responses — worth having when a flow fails opaquely.

### Demo OAuth client

```sh
cd packages/oauth/oauth-client-browser-example
pnpm dev   # http://127.0.0.1:8080
```

Backend selection is the `env` query parameter, resolved in [`src/constants.ts`](../../../packages/oauth/oauth-client-browser-example/src/constants.ts). It defaults to `NODE_ENV`, which `pnpm dev` sets to `development` — so plain `http://127.0.0.1:8080/` already points at the local stack and `?env=development` is redundant.

Only `development` targets the local stack — every other value (including `test` and any typo) falls back to `bsky.social` / `api.bsky.app` for handle resolution and the appview. `development` and `test` additionally set `allowHttp` on the OAuth client, which is what lets either talk to a plain-HTTP loopback PDS.

`?env=test` is therefore **not** a local-stack shortcut. It exists for `oauth.test.ts`, which overrides every endpoint explicitly via query params (`pds_operator_url`, `plc_directory_url`, `handle_resolver`, …) and serves its own bundle through `oauthClientAssetsMiddleware` on a random port, not 8080. Used by hand without those overrides it points at production with HTTP allowed — use `development` instead.

Against `production`, sign in only with accounts you own — this is a real authorization grant against real infrastructure, not a sandbox.

## Browser automation: confirm what you have

This repo registers two browser MCP servers in [`.mcp.json`](../../../.mcp.json) — `playwright` (`@playwright/mcp`) and `chrome-devtools` (`chrome-devtools-mcp`), both launched via `pnpx`. Registration is not connection: the server still has to be enabled and started in your harness, and permissions alone don't make tools exist. Run `claude mcp list` and work with what is actually connected rather than assuming `browser_*` tools are available.

If the Playwright server is registered but has no browser to drive:

```sh
pnpx @playwright/mcp install-browser chrome-for-testing
```

**Known trap:** the repo root `package.json` declares `devEngines.packageManager: pnpm` with `onFail: "error"`, so **any `npx` invocation fails from the repo root** — including the ones MCP plugins use to launch their servers (`npx @playwright/mcp@latest`, `npx chrome-devtools-mcp@…`). Claude Code spawns MCP servers with cwd set to the project root, so a plugin-provided server can fail its health check here while working fine elsewhere. If `claude mcp list` reports a browser server as failed to connect, this is the likely cause; `pnpx` is unaffected, so a server entry using `pnpx` instead of `npx` starts cleanly.

If no browser MCP is reachable and you can't add one, fall back to the mock UI plus the `.po` catalog for discovery, and to running the puppeteer tests with `headless: false` (the option is already there, commented out, in both test files) for interactive debugging.

Tool-name note if you do have the Playwright MCP: `browser_navigate({ url })`, `browser_snapshot({ boxes })`, `browser_click({ element, target })`, `browser_type({ element, target, text })`, `browser_fill_form({ fields })`, `browser_wait_for({ text })`, `browser_console_messages({ level })`, `browser_network_requests({ static })`. `target` takes a ref from a prior snapshot or a CSS selector. Prefer `browser_snapshot` over screenshots — it returns the refs you need to interact, and screenshots don't.

## Writing or extending a UI test

The two browser test files are [`packages/pds/tests/oauth.test.ts`](../../../packages/pds/tests/oauth.test.ts) and [`packages/pds/tests/account-manager.test.ts`](../../../packages/pds/tests/account-manager.test.ts). Read the neighbouring cases first — they are the best available spec for how these flows behave.

**Discover before you assert.** Reading a component tells you what `<Trans>` wraps; it doesn't tell you which branch renders, what the negotiated locale produces, or what a Radix dialog actually puts in the DOM. Get the real strings from the mock UI, a driven browser, or the `.po` catalog, then write the test.

Both files share the `PageHelper` wrapper in [`packages/pds/tests/_puppeteer.ts`](../../../packages/pds/tests/_puppeteer.ts) — use it rather than raw puppeteer:

- `goto(url)` / `reload()` — navigate.
- `assertTitle(text)` — waits for network idle, then asserts `document.title`.
- `clickOnText(text, tag = 'button')` / `clickOnAriaLabel(label, tag = 'button')` / `clickOn(selector)` — each waits for the element to be _visible_ first.
- `typeInInput(name, text)` (targets `input[name="…"]`) / `typeIn(selector, text)` — both clear the field first and return the `ElementHandle`, so you can `press('Enter')` on it.
- `ensureTextVisibility(text, tag = 'p', timeout = 5000)` / `ensureNotification(text)` (`tag = 'div'`).
- `waitForNetworkIdle()`, `navigationClick(text, tag)` / `navigationAction(fn)` for anything triggering a full navigation, `waitForPopup(fn)` → a `PageHelper` for the popup.

`PageHelper` is `AsyncDisposable`; open pages with `await using page = await PageHelper.from(browser, { languages })` so they close even when a test throws.

Two recurring gotchas visible in the existing tests:

- `clickOnText` matches on substring via puppeteer's `::-p-text()`, so a label that is a prefix of another ("Réactiver" inside "Réactiver le compte") hits whichever comes first in DOM order. Target the element directly instead — e.g. `clickOn('[role="dialog"] button[type="submit"]')`.
- Mailed tokens are obtained by spying on the mailer (`jest.spyOn(network.pds.ctx.mailer, 'sendResetPassword')`) and reading `mock.lastCall`; those calls also assert the negotiated `locale`, which is how the i18n path stays covered.

### Running

These suites are stateful — each `it` builds on the account state the previous one left behind — so run the whole file, never a single case:

```sh
cd packages/pds
pnpm test -- tests/oauth.test.ts
```

Go through `pnpm test`: it wraps jest in the postgres/redis script, and `pretest` installs the Chrome build puppeteer needs.

## Related skills

- [testing](../testing/SKILL.md) — runner choice (vitest vs jest), test file location, tsconfig setup. It routes browser-driven work here; come back to it for anything that isn't a UI test. New tests elsewhere in the repo should be vitest — these two files are jest because `pds` hasn't been migrated.
