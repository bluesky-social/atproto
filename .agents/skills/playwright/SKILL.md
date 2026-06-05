---
name: playwright
description: >
  Drive a real browser via the Playwright MCP to interact with the OAuth flows, and the Account Manager UI. Use this skill in TWO situations:
  (A) writing or extending an end-to-end UI test that uses Puppeteer +
  `PageHelper` (e.g. `packages/pds/tests/oauth.test.ts`,
  `packages/pds/tests/account-manager.test.ts`, or any test that boots a browser
  via `puppeteer` / `playwright`) — the skill enforces a discovery-first flow
  where flows are walked through the running app to capture exact strings before
  any code is written; AND (B) demoing, navigating, or debugging the OAuth flow
  or Account Manager interface (http://localhost:2583/account) against a local
  dev environment OR against production via the demo OAuth client at
  http://127.0.0.1:8080/?env=production. Trigger on: `puppeteer` / `playwright`
  imports in tests, requests to "demo / show / walk through / debug" OAuth or
  the account manager, mentions of `PageHelper`, `_puppeteer.ts`,
  `browser_navigate`/`browser_click`/`browser_snapshot`, or anything that needs
  to drive the PDS web UI.
disable-model-invocation: false
---

# Playwright skill

Use the Playwright MCP to drive a real browser against this repo's web UIs:

- **Account Manager** at `http://localhost:2583/account` — account management UI (passwords, emails, handles, sessions).
- **Demo OAuth client** at `http://127.0.0.1:8080/` — the example client app from `packages/oauth/oauth-client-browser-example`. Switch backends via the `env` query parameter:
  - `?env=test` — used by the jest test fixtures (see `packages/pds/tests/oauth.test.ts`).
  - `?env=development` — used against the local `packages/dev-env` stack.
  - `?env=production` — runs the demo client against `bsky.social` / `api.bsky.app` for live testing of OAuth against production.

## When to use this skill

| Situation                                                                     | What to do                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Writing or extending a UI test (oauth, account-manager, anything `puppeteer`) | Follow the **Test workflow** below. Discover the flow with the Playwright MCP first, then write the test.                                                                                                  |
| Demoing / debugging an OAuth flow against the local dev env                   | Boot the dev env + the demo client, navigate to `http://127.0.0.1:8080/?env=development`, drive interactively with `browser_*` tools.                                                                      |
| Demoing / debugging an OAuth flow against **production**                      | Boot only the demo client (no dev env needed), navigate to `http://127.0.0.1:8080/?env=production`. Only sign in with accounts you control. Never automate auth against production accounts you don't own. |
| Demoing / debugging the Account Manager                                       | Boot the dev env, navigate to `http://localhost:2583/account`, sign in as a seeded account.                                                                                                                |

## Setup

```sh
claude plugin install playwright@claude-plugins-official
pnpx @playwright/mcp install-browser chrome-for-testing
```

### VS Code

```sh
code --add-mcp '{"name":"playwright","command":"npx","args":["--yes","@playwright/mcp@latest"]}'
```

### Zed

Install the `mcp-server-playwright` extension, then edit `~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "mcp-server-playwright": {
      "settings": {
        "browser": "chromium",
        "headless": false,
        "vision": false
      }
    }
  }
}
```

## Booting the local stack

### Full AT Protocol dev stack

Run in the background:

```sh
cd packages/dev-env
pnpm dev
```

- PDS server: `http://localhost:2583`
- Account Manager: `http://localhost:2583/account`
- Seed credentials (set in `packages/dev-env/src/mock/index.ts`): `alice.test` / `bob.test` / `carla.test`, all with password `hunter2`.

### Demo OAuth client

Run in the background:

```sh
cd packages/oauth/oauth-client-browser-example
pnpm dev
```

Then navigate to one of:

- `http://127.0.0.1:8080/?env=test` — for jest test fixtures (the test boots its own `TestNetworkNoAppView` and serves the bundled client via `oauthClientAssetsMiddleware`).
- `http://127.0.0.1:8080/?env=development` — wires the demo client to the local dev-env PDS at `http://localhost:2583`.
- `http://127.0.0.1:8080/?env=production` — wires the demo client to `bsky.social` / `api.bsky.app`. Use only with credentials you control.

## Driving the browser

### Navigation & inspection

```js
browser_navigate('http://localhost:2583/account')
browser_snapshot({ boxes: true }) // accessibility snapshot, preferred over screenshots
browser_console_messages({ level: 'error' })
browser_network_requests({ static: false })
```

### Interaction

```js
browser_click({ element: 'button "Sign in"', target: 'ref' })
browser_type({
  element: 'textbox name="username"',
  target: 'ref',
  text: 'alice.test',
})
browser_press_key({ key: 'Enter' })
browser_wait_for({ text: 'Mon compte Atmosphère' })
browser_take_screenshot({ filename: 'evidence.png' })
```

Prefer `browser_snapshot` (accessibility tree) over `browser_take_screenshot` for state inspection — snapshots return refs you can pass to `browser_click` / `browser_type`. Use screenshots as evidence only.

## Test workflow

For UI tests in `packages/pds/tests/{oauth,account-manager}.test.ts` (and any future browser-driven test), follow these phases.

### Phase 1: Discovery (Playwright MCP)

**STOP before grepping or reading source.** Drive the running app through the Playwright MCP and copy the exact visible strings out of snapshots. Reading code is a fallback only when the MCP can't reach the state (e.g. the feature isn't wired up yet).

This catches what the user actually sees — including i18n strings, conditional UI, accessibility issues, and edge cases that source-reading misses.

1. Start the dev env (`cd packages/dev-env && pnpm dev`).
2. Start the demo OAuth client if the test exercises OAuth.
3. Walk the flow with `browser_navigate` / `browser_click` / `browser_type` / `browser_snapshot`.
4. Note the exact button labels, headings, error messages, aria-labels — these become the assertion strings.

The existing `oauth.test.ts` and `account-manager.test.ts` use a non-English default language (`['fr-BE', 'fr', 'en-US', 'en']`) to exercise i18n negotiation. When discovering flows for new cases in those files, set the same languages on the MCP browser, or copy the localized strings shown in the running test fixtures.

### Phase 2: Write the test (Jest + Puppeteer)

UI tests in this repo are jest-based (see the [testing skill](../testing/SKILL.md) for runner choice elsewhere). They use the `PageHelper` wrapper from [`packages/pds/tests/_puppeteer.ts`](../../../packages/pds/tests/_puppeteer.ts) — don't reinvent it.

Template:

```typescript
it('describes the edge case', async () => {
  await using page = await PageHelper.from(browser, { languages })

  await page.goto(new URL('/path', network.pds.url))
  await page.assertTitle('Expected Title')

  await page.clickOnText('Menu', 'a')
  await page.clickOnText('Submenu')

  await page.typeInInput('fieldName', 'edge-case-value')
  await page.clickOnText('Submit')

  await page.waitForNetworkIdle()
  await page.ensureTextVisibility('Error message')

  await page.clickOnText('Back')
  await page.ensureTextVisibility('original-value', 'span')
})
```

Key `PageHelper` methods (full source: [`packages/pds/tests/_puppeteer.ts`](../../../packages/pds/tests/_puppeteer.ts)):

- `page.goto(url)` — navigate.
- `page.assertTitle(text)` — assert page title (waits for network idle first).
- `page.clickOnText(text, tag = 'button')` — click an element by visible text.
- `page.clickOnAriaLabel(label, tag = 'button')` — click by `aria-label`.
- `page.clickOn(selector)` — click any visible element.
- `page.typeInInput(name, text)` — type into `input[name="..."]` (clears first).
- `page.typeIn(selector, text)` — type into any input (clears first).
- `page.ensureTextVisibility(text, tag = 'p', timeout = 5000)` — assert text is visible.
- `page.ensureNotification(text)` — shorthand for `ensureTextVisibility(text, 'div')`.
- `page.waitForNetworkIdle()` — wait for async work to settle.
- `page.navigationClick(text, tag = 'button')` / `page.navigationAction(fn)` — wraps an action that triggers a full navigation.
- `page.waitForPopup(fn)` — returns a `PageHelper` for a popup window opened by `fn`.

The `PageHelper` is `AsyncDisposable` — use `await using page = await PageHelper.from(browser, { languages })` so the page closes on test exit.

### Phase 3: Run the test

UI tests are stateful — always run the full file so all tests run:

```sh
cd packages/pds
pnpm test -- tests/oauth.test.ts
```

## Demo / debug workflow (no test, just drive the UI)

1. Decide which environment you need:
   - Local dev (PDS + demo client): boot both as in **Booting the local stack**, then navigate the MCP browser to `http://127.0.0.1:8080/?env=development` or `http://localhost:2583/account`.
   - Production OAuth flow: boot only the demo client, navigate to `http://127.0.0.1:8080/?env=production`. Sign in only with accounts you own.
2. Walk the flow with `browser_navigate` / `browser_snapshot` / `browser_click` / `browser_type`.
3. When something looks off, capture evidence with `browser_take_screenshot` and check `browser_console_messages({ level: 'error' })` and `browser_network_requests` for failed requests.

## Related skills

- [testing skill](../testing/SKILL.md) — runner choice (vitest vs jest), test file location, tsconfig setup. UI tests here are jest-only; consult the testing skill before touching anything that isn't a UI test.
