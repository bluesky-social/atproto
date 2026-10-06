# OAuth browser example

- FedCM is optional account selection. Validate the configured provider
  and DID, then use ordinary OAuth; never accept the DID hint as authentication.
- `fedcm_mode=active` must call `navigator.credentials.get()` synchronously from
  a genuine click and supports exactly one configured provider.
- Preserve the selected DID in OAuth app state and reject a different callback
  subject, including automatic session restoration through cross-tab events.
- Keep the request's AbortController through delayed PAR, cancel on manual sign-in
  or unmount, and recheck cancellation after `authorize()` before navigation: the
  SDK can finish PAR preparation after its signal is aborted.
