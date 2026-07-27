# e2e baseline — before oauth-provider-ui redesign

Captured on branch `oauth-provider-redesign` at commit `c7a7b198e`.

Both suites are **fully green** before any redesign work. Any failure appearing
after this point is caused by the redesign and must be either fixed or
explicitly justified as an intentional UX change.

Runner: jest (the `pds` package has not been migrated to vitest), via
`packages/dev-infra/with-test-redis-and-db.sh`.

## packages/pds/tests/oauth.test.ts

```
Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
```

Failing before any redesign work: **none**

## packages/pds/tests/account-manager.test.ts

```
Test Suites: 1 passed, 1 total
Tests:       13 passed, 13 total
```

Failing before any redesign work: **none**

## Note on a stale prior baseline

An earlier record (from the fork's abandoned v2 UI redesign) described a
known-failing baseline of 5/6 in `oauth.test.ts` and 13/13 in
`account-manager.test.ts`. That baseline belonged to a branch that no longer
exists — fork `main` was fast-forwarded to clean upstream on 2026-07-27. It does
**not** apply to this work. The numbers above supersede it.

## After phase 1 (2026-07-27, commit `00db5c1b9`)

Both suites back to **7/7** and **13/13** — no deltas against the baseline, and
no test files were modified.

Two regressions were introduced and fixed during the phase; both are recorded
because each cost a full e2e cycle to find:

| Regression | Cause | Fix |
|---|---|---|
| oauth 4/7 after the feedback rebuild | shadcn `AlertTitle` renders a `<div>`; the old `AdmonitionTitle` rendered `<h3>`, which `ensureTextVisibility('Avertissement', 'h3')` requires | `Notice` renders a real `<h3>` |
| account-manager 0/13 and oauth 6/7 after the shell rebuild | `AccountShell` rendered a page-level `<title>`; React hoists every `<title>` to `<head>` and the **last** wins, so `document.title` became `Accueil` instead of the app name | `AccountShell` renders no `<title>`; only `AppShell` does |

The second is the one to remember: the old `LayoutPage` only avoided it by
skipping the page heading entirely at the base route, which is what the
`basePath` prop was for. Deleting `basePath` as "unused" removed that guard.

## After phase 3 (2026-07-27)

Both suites back to **7/7** and **13/13**, no test files modified.

Regressions found and fixed during the phase:

| Regression | Cause | Fix |
|---|---|---|
| account-manager 12/13, `rejects custom domain when not configured` | Base UI's `DialogContent` is `fixed` and vertically centred with **no height cap**. A tall dialog overflows both edges of the 800×600 e2e viewport, and a fixed element cannot be scrolled into view — so `Retour` was unreachable. The old `DialogSimple` capped content at `85vh`. | `DialogShell` gets `max-h-[85vh] overflow-y-auto` |
| Two msgids silently vanished (`Select domain`, `Type your username`) | `HandleField` passed `t` down as a **prop**; the Lingui macro only transforms `` t`...` `` in a scope that imports the hook, so those templates were never compiled and would have rendered untranslated | call `useLingui()` in the scope that uses it |

Neither would have been caught by a passing type-check. The first needed a
short viewport; the second only showed up in the `.po` diff.

## After phase 4 — redesign complete (2026-07-27)

Both suites at **7/7** and **13/13**. **No test file was modified at any point
in the project**, and the message catalogs end where they started apart from two
intentional changes (`Branding` retired with the palette demo route, `Navigation`
added for the mobile nav).

Final state: 344 messages, 3 untranslated French entries — all three pre-date
this work.

## How to reproduce

```bash
# ensure ports 2582/2583 are free (stop the local switchback docker stack)
cd packages/pds
pnpm test -- tests/oauth.test.ts
pnpm test -- tests/account-manager.test.ts
```
