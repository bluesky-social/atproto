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

## How to reproduce

```bash
# ensure ports 2582/2583 are free (stop the local switchback docker stack)
cd packages/pds
pnpm test -- tests/oauth.test.ts
pnpm test -- tests/account-manager.test.ts
```
