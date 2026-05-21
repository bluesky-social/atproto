# Handle update — implementation summary

This document captures what was implemented for the "change handle from the
account-manager UI" feature on `msi/account-manager-handle-update`, and the
notable lessons that came out of mirroring the email-update plan.

## What shipped

End-to-end handle change from the OAuth account manager UI, layered over the
same skeleton as the email update work referenced in `HANDLE_UPDATE_PLAN.md`.

### 1. `@atproto/oauth-provider-api`

[api-endpoints.ts](packages/oauth/oauth-provider-api/src/api-endpoints.ts):

- Added `'/update-handle'` endpoint with input
  `{ sub: string, handle: string }` and `{ success: true }` output.
- New `UpdateHandleInput` type.

Single-step (no two-step request/confirm) — handles are public and don't need
an out-of-band confirmation token, unlike emails.

### 2. `@atproto/oauth-provider`

- [account-store.ts](packages/oauth/oauth-provider/src/account/account-store.ts):
  added `updateHandle(data)` method to the `AccountStore` interface AND to the
  `isAccountStore` runtime checker array. Re-exported `UpdateHandleData` as a
  type alias of `UpdateHandleInput`.
- [account-manager.ts](packages/oauth/oauth-provider/src/account/account-manager.ts):
  added `AccountManager.updateHandle(deviceId, deviceMetadata, input, account)`
  using the standard pre-hook → store call → post-hook pattern.
- [oauth-hooks.ts](packages/oauth/oauth-provider/src/oauth-hooks.ts): added
  `onUpdateHandle` (before) and `onUpdatedHandle` (after) lifecycle hooks.
- [create-api-middleware.ts](packages/oauth/oauth-provider/src/router/create-api-middleware.ts):
  added the `/update-handle` route. Uses the existing `handleSchema` already
  exported from `types/handle.ts`. Auth via `authenticate.call(this, req, res)`.

### 3. PDS

The big architectural shift: the handle-update orchestration (PLC document
update, local account update, identity event sequencing) moved out of the xrpc
handler and into a new method on `AccountManager`, so the OAuth store can
reuse it.

- [account-manager.ts](packages/pds/src/account-manager/account-manager.ts):
  - Constructor now takes `sequencer`, `plcClient`, `plcRotationKey` (mirrors
    the email work that added `mailer`).
  - Renamed the old low-level `updateHandle` (the db-only update) to
    `updateAccountHandle`.
  - New high-level `updateHandle(did, rawHandle)` that does
    normalize → availability check → PLC update (or did:web verification) →
    db update → sequence identity event.
- [oauth-store.ts](packages/pds/src/account-manager/oauth-store.ts):
  `updateHandle({ sub, handle })` delegates to the manager and translates
  `UserAlreadyExistsError` / `XrpcInvalidRequestError` into
  `HandleUnavailableError` (with the right `'taken' | 'syntax'` reason).
- [identity/updateHandle.ts](packages/pds/src/api/com/atproto/identity/updateHandle.ts):
  shrunk to a thin handler that either forwards to the entryway or calls
  `accountManager.updateHandle(...)`.
- [admin/updateAccountHandle.ts](packages/pds/src/api/com/atproto/admin/updateAccountHandle.ts):
  updated to call the renamed `updateAccountHandle`.
- [context.ts](packages/pds/src/context.ts): hoisted `plcRotationKey`
  initialization above the `accountManager` construction so it can be passed
  in.

Notable: unlike email, I did **not** restrict handle change to password
sessions — it stays available to authenticated OAuth sessions per the standard
`com.atproto.identity.updateHandle` permission check
(`permissions.assertIdentity({ attr: 'handle' })`). The plan flagged this as a
judgment call; the existing scope semantics are preserved.

### 4. UI — `@atproto/oauth-provider-ui`

- [data/handle.ts](packages/oauth/oauth-provider-ui/src/data/handle.ts): new
  `useUpdateHandle()` and `useVerifyHandleAvailability()` React-Query hooks,
  matching the pattern from `data/email.ts`.
- [lib/api.ts](packages/oauth/oauth-provider-ui/src/lib/api.ts): added an
  `Api.updateHandle()` shortcut method.
- [contexts/session.tsx](packages/oauth/oauth-provider-ui/src/contexts/session.tsx):
  added an `'/update-handle'` entry to `onFetchSuccess` that calls
  `updateAccount(input.sub, { preferred_username: input.handle })` to keep
  the cached session in sync.
- [components/update-handle-view.tsx](packages/oauth/oauth-provider-ui/src/components/update-handle-view.tsx):
  new view that reuses the handle validation logic and constants from
  `lib/handle.ts` (`MIN_LENGTH`, `MAX_LENGTH`, `MAX_FULL_LENGTH`,
  `ValidDomain`, `isValidDomain`).
- [pages/account/(authenticated)/handle/page.tsx](packages/oauth/oauth-provider-ui/src/pages/account/(authenticated)/handle/page.tsx):
  thin adapter that pulls `account` from `useAuthenticatedSession()` and
  `availableUserDomains` from `useCustomizationData()`.
- [route.tsx](packages/oauth/oauth-provider-ui/src/pages/account/(authenticated)/route.tsx):
  registered `/handle` at position 35 (between password=30 and email=40)
  with the `AtIcon`. No verification banner — handles aren't a
  verified concept the same way emails are.
- [account-page.html](packages/oauth/oauth-provider-ui/account-page.html):
  added a `/update-handle` mock case that updates `preferred_username` on
  the in-memory account map, with a "taken by another account" branch that
  returns the proper `handle_unavailable` error shape.

### 5. Locales

Added inline `<Trans>`/`t\`...\`` strings, ran `pnpm i18n` to extract, and
hand-translated the new strings into `fr/messages.po` so the e2e test (which
runs in French) can assert against them. Other locales got the new `msgid`
entries with empty `msgstr` — they'll fall back to the English source until
translated.

### 6. Tests

[account-manager.test.ts](packages/pds/tests/account-manager.test.ts): added
"allows changing the username" e2e test that drives the full UI flow (click
"Nom d'utilisateur" link, type new segment, click "Modifier le nom
d'utilisateur", assert the new handle appears).

### 7. Changeset

Updated [`.changeset/sweet-bobcats-rescue.md`](.changeset/sweet-bobcats-rescue.md)
to mention handle updates alongside the email work.

## Lessons

- **`isAccountStore` is a runtime guard, not a type check.** Adding an
  interface method without adding it to the array silently passes type-check
  but fails the runtime store-validation. Easy to miss — the type system does
  catch it via the `readonly [...]` literal type once you try to add the new
  method, but only because that array is typed as a tuple.
- **The OAuthProvider/PDS error mapping has a strict contract.** `*Confirm`
  store methods return `Account | null`; `null` is the *only* path that
  produces `InvalidRequestError('Invalid token')`. For non-confirm methods
  like `updateHandle`, throwing `HandleUnavailableError` propagates to the UI
  via the existing `HandleUnavailableError.is(json)` parser in `lib/api.ts`.
- **Mailer/sequencer/plc dependencies need to live in `AccountManager`, not in
  xrpc handlers**, so the OAuth store can reuse them. The email branch had
  already moved mail; this branch did the same for handle update. The
  `context.ts` ordering (init `plcRotationKey` before constructing
  `accountManager`) needed to flip.
- **Don't break existing low-level callers when renaming.** The pattern from
  the email branch was: rename the low-level db helper (`updateEmail` →
  `updateAccountEmail`) and add a new high-level entry point with the original
  name. I followed that here: `updateHandle` (db helper) →
  `updateAccountHandle`, plus a new high-level `updateHandle`. The admin
  endpoint, which only wants the db update (because it does its own PLC
  handling for entryway-mode), now calls `updateAccountHandle`.
- **The lingui flow is `extract → translate → compile`.** `pnpm i18n` does
  extract+compile; if you skip the manual translation step in the middle,
  your test assertions in non-English will fail because lingui silently falls
  back to the English source string for missing translations. The .po files
  are generated and should not be hand-written *except* to fill in `msgstr`
  for languages you specifically need.
- **`onFetchSuccess` is the cleanest way to keep the local session cache in
  sync with backend mutations.** `Api` accepts a map of endpoint → callback;
  `session.tsx` uses it to call the local `updateAccount(...)` helper after a
  successful `/update-email-confirm`, `/verify-email-confirm`, and now
  `/update-handle`. No need to refetch the account.
- **Handle change is a single-step flow.** Email needed two steps (send token,
  then confirm with new email + token) plus a follow-up verification of the
  new address. Handle change is just "submit new handle". This means: no
  `*Request` / `*Confirm` split, no `tokenRequired` plumbing, no
  `sendConfirmationEmail` mail, no `email_verified` reset. The view component
  is correspondingly simpler than `UpdateEmailView`.
- **Reuse the existing `lib/handle.ts` validators.** The sign-up flow already
  defines `MIN_LENGTH`, `MAX_LENGTH`, `MAX_FULL_LENGTH`, and the `ValidDomain`
  branded type. Re-implementing them in the update view would risk drift.
- **The hook naming convention in `oauth-hooks.ts` is slightly inconsistent.**
  Email uses `onChangeEmailRequest`/`onChangeEmailRequested` for the request
  side and `onUpdateEmailConfirm`/`onUpdateEmailConfirmed` for the confirm
  side. For the single-step handle flow I picked
  `onUpdateHandle`/`onUpdatedHandle` and stayed consistent within the pair.
