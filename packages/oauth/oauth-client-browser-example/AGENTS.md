# OAuth browser example

- FedCM is optional account selection. Validate the configured provider
  (as https only when `"any"` was requested; the OAuth `sub` check is then the
  guard) and DID, then use ordinary OAuth; never accept the DID hint as authentication.
- `fedcm_mode=active` must call `navigator.credentials.get()` synchronously from
  a genuine click and supports exactly one provider entry (`"any"` counts as one).
- Preserve the selected DID in OAuth app state and reject a different callback
  subject, including automatic session restoration through cross-tab events.
- Keep the request's AbortController through delayed PAR, cancel on manual sign-in
  or unmount, and recheck cancellation after `authorize()` before navigation: the
  SDK can finish PAR preparation after its signal is aborted.
- `fedcm_idp_registration=true` also requests registered IdPs (`configURL: "any"`,
  type `https://atproto.com`); the returned configURL is unknown up front, so
  the OAuth `sub` check is the guard. Mark code it obsoletes with
  `// @NOTE IdP registration:`.
