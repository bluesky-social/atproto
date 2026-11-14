# OAuth provider

- [FEDCM.md](FEDCM.md) is the draft interoperability profile for FedCM
  (`https://atproto.com`). Update it in the same change as any FedCM behavior
  an app or another IdP could observe.
- FedCM is opt-in and returns a signed authentication token only. It must not
  create OAuth grants, credentials, or pushed authorization requests.
- The FedCM accounts endpoint reads only the dedicated `/oauth/fedcm` shadow
  cookies and requires the exact current device/session match. Never use
  `deviceManager.load` or ordinary-cookie mismatch grace in these handlers.
  The assertion endpoint uses the same device cookie and signs only for accounts
  in `listFedcmAccounts`.
- Keep the accounts list, first-party `Set-Login` status, and the UI's pushed
  accounts (`FedcmRegistrationData.eligibleDids`) aligned through
  `listFedcmAccounts`. Reflect assertion CORS only after client/origin
  validation; account enumeration does not expose credentialed CORS.
