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

Routing is now file-based: `src/routes/` is the route tree and
`@tanstack/router-plugin` generates it, code-splitting each page so it is only
downloaded when visited. Access checks run in `beforeLoad` and redirect before a
page renders, rather than in the page itself, and the devices and apps pages
load their data through the route's `loader`.
