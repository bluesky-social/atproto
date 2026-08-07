---
'@atproto/oauth-provider-ui': minor
---

Account manager: make the selected account and the authentication step part of
the router instead of in-component state.

The account manager now uses real routes for authentication (`/account/sign-in`,
`/account/sign-up`) and encodes the active account in the URL
(`/account/u/<handle-or-did>/…`). A reload now restores both the current
sub-page and the selected account from the URL, so a device with several
remembered accounts no longer drops back to the account picker on refresh. This
replaces the previous `#step=` URL-fragment state machine (still used by the
third-party consent flow) for the account-manager entry.
