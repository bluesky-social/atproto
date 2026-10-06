# OAuth provider

- FedCM is opt-in and returns a selected DID as a routing hint. It must not create
  OAuth grants, credentials, or pushed authorization requests.
- Cross-site FedCM handlers read only the dedicated `/oauth/fedcm` shadow cookies
  and require the exact current device/session match. Never use `deviceManager.load`
  or ordinary-cookie mismatch grace in these handlers.
- Keep accounts, assertion eligibility, and first-party `Set-Login` status aligned
  through `listFedcmAccounts`. Reflect assertion CORS only after client/origin
  validation; account enumeration does not expose credentialed CORS.
