# OAuth provider

- FedCM is opt-in and returns a selected DID as a routing hint. It must not create
  OAuth grants, credentials, or pushed authorization requests.
- The FedCM accounts endpoint reads only the dedicated `/oauth/fedcm` shadow
  cookies and requires the exact current device/session match. Never use
  `deviceManager.load` or ordinary-cookie mismatch grace in these handlers.
  The assertion endpoint deliberately does not require a device session: it
  answers for any active local account (see the `TODO(fedcm)` in
  `create-fedcm-middleware.ts`).
- Keep the accounts list, first-party `Set-Login` status, and the UI's pushed
  accounts (`FedcmRegistrationData.eligibleDids`) aligned through
  `listFedcmAccounts`. Reflect assertion CORS only after client/origin
  validation; account enumeration does not expose credentialed CORS.
