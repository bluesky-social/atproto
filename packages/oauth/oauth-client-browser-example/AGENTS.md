# OAuth browser example

- FedCM returns an `atproto-id+jwt` token. Validate the configured provider
  (as https only when `"any"` was requested) and verify the token
  (`verifyFedcmIdToken`) before using its DID for anything. `scope=atproto`
  with FedCM enabled signs in without OAuth (an identity session); other
  scopes use the verified DID as the OAuth `login_hint`.
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
