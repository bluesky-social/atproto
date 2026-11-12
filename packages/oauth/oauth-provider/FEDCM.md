# FedCM for atproto (draft)

> **Draft.** This document describes the FedCM prototype in this repository (`@atproto/oauth-provider`, `@atproto/oauth-provider-ui`, and the browser example app). It is not a ratified atproto spec. It records what an identity provider and an app must agree on to work together, as the prototype implements it today. Expect breaking changes. Behavior marked **(Chrome experimental)** depends on Chrome features behind flags.

## What this is for

[FedCM](https://w3c-fedid.github.io/FedCM/) (Federated Credential Management) is a browser API that lets a website show the user a browser-owned account picker for accounts they're already signed in to with an identity provider.

In atproto, the identity provider is the account's OAuth authorization server, usually its PDS. The app is any atproto OAuth client. With FedCM, the user can pick a remembered account instead of typing a handle. The app then signs the user in with ordinary atproto OAuth.

In the flow the prototype implements today, FedCM selects the account and OAuth signs the user in: the app learns the account's DID from FedCM, then runs OAuth for that DID. The DID that FedCM returns in this flow is an unsigned hint, not proof of identity. An authentication-only mode, where FedCM returns a token the app can verify without OAuth, is planned (see Open questions).

## Roles and terms

- **Identity provider (IdP):** the OAuth authorization server for an account. For a standalone PDS, that's the PDS itself. For PDSes behind an entryway, it's the entryway. Every IdP URL below is on the authorization server's issuer origin.
- **App:** the relying party, an atproto OAuth client identified by its `client_id`.
- **Config URL:** the URL of the IdP's FedCM config file. The browser starts from it.
- **Remembered account:** an account signed in on this browser with "Remember this account on this device" checked.

## Two ways an app finds the IdP

1. **Configured provider.** The app already knows the IdP and passes its config URL. This works in Chrome without flags. It doesn't fit atproto, where there are many IdPs and each user picks their own: an app can't know in advance which IdP to ask, and listing every PDS isn't practical. It's supported during this phase for prototyping, because it runs in Chrome today without flags.
2. **Registered provider (Chrome experimental).** The IdP registers itself with the browser when the user signs in. The app asks for "any registered provider of type `https://atproto.com`", without knowing which PDS the user is on. This is the mode that fits atproto. It needs both `chrome://flags/#fedcm-idp-registration` and `chrome://flags/#fedcm-lightweight-mode`.

   The standard is developed at [w3c-fedid/idp-registration](https://github.com/w3c-fedid/idp-registration). Browser implementations currently lag behind the standard described there, which has moved to a handle-based design. This document follows what Chrome implements today (`IdentityProvider.register(configURL)`, and apps requesting `configURL: "any"` with a `type`), not the current draft.

Most requirements below apply to both. Differences are called out.

## The profile type: `https://atproto.com`

The string `https://atproto.com` identifies this profile. An IdP lists it in its config file's `types`. An app asks for it when requesting registered providers. Chrome only offers registered IdPs whose config lists the exact type requested. Listing the type is a promise that the IdP behaves as this document describes.

Future versions or optional capabilities may get their own type strings. An IdP would list every type it supports.

## Identity provider requirements

### Origin

All FedCM endpoints, the config file, and the login URL are served on the authorization server's issuer origin. Apps rely on that: the origin of the config URL the browser returns should be the issuer of the selected account's authorization server.

### Config file

- **URL:** `<issuer>/oauth/fedcm/config.json`. The prototype uses this fixed path, and apps in configured mode build the config URL from it. (Open question: keep the fixed path, or advertise it in authorization server metadata.)
- **Response:** JSON, cacheable (the prototype sends `Cache-Control` with a 5-minute max age).

```json
{
  "accounts_endpoint": "<issuer>/oauth/fedcm/accounts",
  "id_assertion_endpoint": "<issuer>/oauth/fedcm/assertion",
  "login_url": "<issuer>/account/sign-in?fedcm=true",
  "types": ["https://atproto.com"]
}
```

The endpoint URLs are the IdP's choice. Apps read them only through the browser. `types` must include `https://atproto.com`.

### Well-known file (configured provider only)

FedCM requires `https://<registrable domain>/.well-known/web-identity` to list the config URL. For example, a PDS at `pds.example.com` needs the file at `https://example.com`:

```json
{ "provider_urls": ["https://pds.example.com/oauth/fedcm/config.json"] }
```

The prototype serves this document on the issuer origin. If the issuer is a subdomain, the operator must publish it at the registrable domain themselves. **(Chrome experimental)** Chrome skips this check for registered providers.

### Login status

The browser only shows an IdP's accounts if the IdP has told it the user is signed in. The IdP must keep this status current:

- **`Set-Login` header.** On responses to the account pages, the authorization page, and every call to the sign-in UI's API, the IdP sends `Set-Login: logged-in` when the browser has at least one eligible account (below), and `Set-Login: logged-out` otherwise.
- **After sign-in at the login URL,** the page calls `navigator.login.setStatus('logged-in')`, then `IdentityProvider.close()`. That lets the browser continue the FedCM request that sent the user there.

### Eligible accounts

An account is shown to FedCM when all of these hold:

- it is remembered on this browser;
- it has a handle (a DID is not user readable, so the browser should never have to show one);
- it is active (not deactivated or taken down);
- it signed in within the IdP's authentication max age (7 days by default), so it doesn't need a password again.

The accounts endpoint, the `Set-Login` header, and pushed accounts must all use this same rule. If they disagree, the browser shows accounts the IdP will refuse, or hides accounts it would accept.

### Accounts endpoint (configured provider)

The browser calls it with the IdP's cookies. Registered providers don't use it.

- **Request:** `GET`, with `Sec-Fetch-Dest: webidentity`, which only the browser can send. Other requests get `400 invalid_request`.
- **Response:**

```json
{
  "accounts": [
    {
      "id": "did:plc:…",
      "username": "@alice.example.com",
      "name": "Alice",
      "picture": "https://…"
    }
  ]
}
```

- `id` **must** be the account's DID.
- `username` is `@` followed by the handle.
- `name` and `picture` are optional.
- The IdP never includes an email address.
- **No eligible accounts:** `401` with `{"error": {"code": "login_required"}}`.
- The endpoint is read-only. It must not create or refresh sessions, and must not send CORS headers. The response goes to the browser, not to the app.

### Pushed accounts and registration (registered provider, Chrome experimental)

Chrome never calls the accounts endpoint for a registered provider. The IdP pushes the account list instead, from its own pages:

1. On every IdP page load where the session list may have changed (sign-in, sign-out, account switch, revisits), the page computes the eligible accounts.
2. If there are any, it calls:

```js
navigator.login.setStatus('logged-in', {
  accounts: [
    { id: did, name, email: '@handle', picture },
    // …
  ],
  expiration: authenticationMaxAgeMs,
})
await IdentityProvider.register(configUrl)
```

3. If there are none, it calls `navigator.login.setStatus('logged-out')`, which also drops previously pushed accounts.

Account fields:

- `id` **must** be the DID.
- `name` is the display name, falling back to `@handle`. It is never a DID.
- `email` is `@handle`. Chrome requires this field for pushed accounts and has no `username`. The IdP never puts a real email address here.
- `picture` is optional.

Other rules:

- `expiration` is the authentication max age in milliseconds. Each push renews it. Leaving it out would make the accounts never expire in Chrome.
- Sessions without "remember me" are never pushed.
- Registration happens silently on every sign-in. Chrome currently shows no prompt.
- The two-argument `setStatus` needs `#fedcm-lightweight-mode`. Without it, Chrome throws (`Overload resolution failed`) and nothing is pushed. These calls are best-effort and must never break sign-in.
- A bare `Set-Login: logged-in` keeps previously pushed accounts. `logged-out` drops them.

### Login URL

`login_url` is where the browser sends the user when they have no eligible account. It's an ordinary sign-in page. It updates login status and calls `IdentityProvider.close()` (see Login status) only after a remembered, active sign-in, sign-up, or choice of an already remembered account. It never does so for sessions without "remember me". Its path and query are the IdP's choice.

### Assertion endpoint

The browser calls it after the user picks an account, and passes the response to the app.

**Request:** `POST`, `application/x-www-form-urlencoded`, with `Sec-Fetch-Dest: webidentity`, the browser's `Origin` header for the app, and the IdP's cookies. Fields:

- `account_id`: the picked account's DID. It must be a valid DID.
- `client_id`: the app's atproto OAuth `client_id`, which the app passed to FedCM as `clientId`.
- Any other fields the browser sends (for example `params`, `is_auto_selected`, `disclosure_text_shown`) are ignored.

**Checks, in order:**

1. **Browser request and shape.** `Sec-Fetch-Dest: webidentity` is present, and the body parses with a valid DID and `client_id`. Failure → `400 invalid_request`.
2. **Client type.** `client_id` is a discoverable client (an https URL to client metadata). A loopback client is also accepted if the IdP allows loopback clients (a development setting). Failure → `403 unauthorized_client`.
3. **Origin.** The `Origin` header is a plain origin using https, or http on a loopback host if loopback clients are allowed. Failure → `400 invalid_request`.
4. **Origin matches the client.**
   - Discoverable client: `Origin` equals the origin of the `client_id` URL.
   - Loopback client: `Origin` equals the origin of one of its loopback `redirect_uris`.

   Failure → `403 unauthorized_client`.

5. **Client metadata.** The IdP fetches and validates the client metadata, as it would for OAuth. Failure → `403 unauthorized_client`.
6. **Account.** `account_id` is an active account on this IdP. Failure → `401 login_required`.

**Response:** CORS headers allowing the request's origin with credentials, and:

```json
{ "token": "did:plc:…" }
```

**Placeholder (prototype phase):** the token is the DID itself. It's unsigned and is not proof of anything (see App requirements). Whether this should become a verifiable token is an open question (see Open questions).

**Session requirement (prototype behavior, open question):** step 6 does **not** require a session for that account on this browser. Chrome may still list an account the IdP pushed earlier after its session ends. Answering anyway lets the app continue to OAuth, where the user signs in again. This differs from FedCM's usual meaning, "this signed-in user agrees to share with this app". It's acceptable here only because the token is a bare hint, and because which PDS hosts a DID, and whether the account is active, is already public in atproto. Alternatives under consideration:

- require any account remembered on this browser, including ones that need a password again;
- require a live session, and re-authenticate in a FedCM `continue_on` popup.

### Errors and response headers

Every FedCM endpoint returns errors as JSON, with the status codes above:

```json
{ "error": { "code": "login_required" } }
```

Codes: `invalid_request` (400), `unauthorized_client` (403), `login_required` (401), `internal_error` (500). Accounts and assertion responses are not cacheable (`Cache-Control: no-store`) and vary on `Origin`.

## App requirements

### Requesting an account

Configured provider:

```js
navigator.credentials.get({
  mediation: 'required',
  identity: {
    mode: 'passive', // or 'active'
    providers: [{ configURL: '<issuer>/oauth/fedcm/config.json', clientId }],
  },
})
```

Registered provider (Chrome experimental):

```js
providers: [{ configURL: 'any', type: 'https://atproto.com', clientId }]
```

- `clientId` **must** be the app's atproto OAuth `client_id`. The page's origin must match it, as described in the assertion checks.
- An app may combine explicit config URLs with the `any` entry.
- `passive` mode can run on page load. `active` mode must be called directly from a user's click, and Chrome then allows exactly one provider entry (`any` counts as one).
- If the app asks for `any` and no IdP is registered, Chrome rejects with an error. Apps must treat that like any other FedCM failure.

### Handling the result

The browser returns an `IdentityCredential` with `configURL` and `token`.

1. **Check `configURL`.** For a configured provider, it must be one the app requested. For a registered provider the app can't know it in advance, so it must at least be https.
2. **Check `token` is a DID.** Treat it only as the account the user picked.
3. **Run atproto OAuth for that DID.** Resolve the DID to its PDS and authorization server as usual, and start OAuth with the DID as the sign-in hint (`login_hint`). Apps should also check that the authorization server's issuer origin matches the origin of `configURL`. The prototype example doesn't do this yet.
4. **Check the result.** When OAuth completes:
   - The app **must** complete atproto OAuth's [identity authentication](https://atproto.com/specs/oauth#identity-authentication) checks before trusting `sub`. It resolves the DID document and takes the declared PDS, confirms through the PDS's resource server metadata that the PDS points to the authorization server bound to this session, and confirms that the authorization server metadata's `issuer` matches that server's origin. atproto OAuth client libraries such as `@atproto/oauth-client` already do this. FedCM doesn't change or replace it.
   - In addition, `sub` **must** equal the DID picked in FedCM. Otherwise reject the session. Keep the picked DID across the redirect, for example in OAuth `state`.
5. **Fall back.** On any FedCM error, rejection, or dismissal, show the normal handle sign-in.

In this flow, the token is an unsigned DID that passes through page JavaScript, so the app must not treat it as authentication.

## Security and privacy considerations

- **Today's token is a hint.** In the current flow, the proof is the OAuth result: `sub` after atproto OAuth's identity authentication checks, plus the match with the picked DID, as described above.
- **Malicious registered providers (Chrome experimental).** Registration is silent, so any site can register itself with type `https://atproto.com`, push a fake account, and answer with its own DID. Its authorization server can then approve OAuth, and the app's checks pass, because `sub` really is that DID and its DID document really points to the attacker's PDS and authorization server. The user ends up signed in to the app as the attacker's account (login CSRF that needs the user's click). Apps should show the signed-in handle clearly. The `configURL`-to-issuer check limits inconsistent providers, not malicious ones.
- **No email addresses.** The IdP never sends email addresses to the browser. Pushed accounts carry `@handle` in Chrome's required `email` field.
- **Pushed accounts expire** after the authentication max age, unless the IdP pushes again.
- **What the assertion endpoint reveals:** whether a DID is an active account on this IdP, to FedCM requests from validated clients. This is public in atproto anyway (DID documents and `com.atproto.sync.getRepoStatus`).
- **The IdP learns which app the user picked an account for.** It would learn the same through OAuth.

## Not part of the interoperability contract

These are details of this implementation that other IdPs may do differently:

- **Cookies.** The prototype keeps FedCM-only copies of its device and session cookies (`fedcm-dev-id`, `fedcm-ses-id`; `Secure`, `HttpOnly`, `SameSite=None`, `Path=/oauth/fedcm`), so its normal cookies can stay `SameSite=Lax` or `Strict`.
- **Login URL details:** its path and the `fedcm=true` query.
- **How IdP pages learn what to push:** server-rendered data, in this implementation.
- **Enabling FedCM on the PDS:** `PDS_OAUTH_FEDCM_ENABLED`, and `PDS_OAUTH_FEDCM_ALLOW_LOOPBACK_CLIENTS` for development.

## Open questions

- **Session requirement.** Should the assertion endpoint only answer for accounts signed in on this browser? (See the assertion endpoint.)
- **Config discovery.** Keep the fixed config path, or advertise the config URL in authorization server metadata?
- **Issuer check.** Should the `configURL`-to-issuer check be a requirement for apps rather than a recommendation?
- **Pushed `email`.** Keep `@handle` in `email`, or wait for a first-class handle field in Chrome?
- **Verifiable token.** The bare-DID token is a placeholder. Should the assertion return a token the app can verify (signed, bound to the app and a nonce), and if so, what signs it, which claims it carries, and how long it lives? A verifiable token would also tighten the session requirement: the IdP shouldn't vouch for an account without a live session.
- **Authentication-only sign-in.** Should there be a mode that returns a signed token, for apps that don't need OAuth? That would need defined `params`, a token format, and capability discovery, probably as an additional type.
- **The handle-based IdP Registration spec.** The current [IdP Registration](https://w3c-fedid.github.io/idp-registration/) draft has moved to handles (`register(handle)`, `federation`, signed handle-verification tokens), which Chrome doesn't implement yet. Registered-provider behavior here follows Chrome's implementation and will change if Chrome adopts the spec.
