# OAuth browser example

- FedCM is optional passive account selection. Validate the configured provider
  and DID, then use ordinary OAuth; never accept the DID hint as authentication.
- Preserve the selected DID in OAuth app state and reject a different callback
  subject, including automatic session restoration through cross-tab events.
- Recheck cancellation after `authorize()` and before navigation: the SDK can
  finish PAR preparation after its signal is aborted.
