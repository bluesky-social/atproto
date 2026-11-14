# FedCM for atproto (draft)

> **Draft.** This document describes the FedCM prototype in this repository (`@atproto/oauth-provider`, `@atproto/oauth-provider-ui`, and the browser example app). It is not a ratified atproto spec. It records what an identity provider and an app must agree on to work together, as the prototype implements it today. Expect breaking changes. Behavior marked **(Chrome experimental)** depends on Chrome features behind flags.

## What this is for

[FedCM](https://w3c-fedid.github.io/FedCM/) (Federated Credential Management) is a browser API that lets a website show the user a browser-owned account picker for accounts they're already signed in to with an identity provider.

In atproto, the identity provider is the account's OAuth authorization server, usually its PDS. The app is any atproto OAuth client. With FedCM, the user can pick a remembered account instead of typing a handle. FedCM returns a signed token that proves which account the user picked. An app that only needs to know who the user is can verify the token and stop there. An app that needs access to the account's data runs ordinary atproto OAuth for the picked account.

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
- `params`: a JSON string of exactly `{"response_type": "id_token", "nonce": "<1 to 256 characters>"}`. The app passes the object as `params` to FedCM, and the browser sends it as a JSON string. Missing `params`, invalid JSON, other keys, another `response_type`, or a missing or out-of-range `nonce` is refused.
- Any other fields the browser sends (for example `is_auto_selected`, `disclosure_text_shown`) are ignored.

**Checks, in order:**

1. **Browser request and shape.** `Sec-Fetch-Dest: webidentity` is present, and the body parses with a valid DID, `client_id`, and `params`. Failure → `400 invalid_request`.
2. **Client type.** `client_id` is a discoverable client (an https URL to client metadata). A loopback client is also accepted if the IdP allows loopback clients (a development setting). Failure → `403 unauthorized_client`.
3. **Origin.** The `Origin` header is a plain origin using https, or http on a loopback host if loopback clients are allowed. Failure → `400 invalid_request`.
4. **Origin matches the client.**
   - Discoverable client: `Origin` equals the origin of the `client_id` URL.
   - Loopback client: `Origin` equals the origin of one of its loopback `redirect_uris`.

   Failure → `403 unauthorized_client`.

5. **Client metadata.** The IdP fetches and validates the client metadata, as it would for OAuth. Failure → `403 unauthorized_client`.
6. **Signed in on this browser.** `account_id` must be an eligible account (above) signed in on the browser making the request, under the IdP's own session state. That state reaches the IdP through the credentials the browser attaches to FedCM requests. The IdP signs only for that browser, and only while the account is eligible. Failure → `401 login_required`.

**Response:** CORS headers allowing the request's origin with credentials, and:

```json
{ "token": "<compact JWS>" }
```

The token is a compact JWS, shaped like an OIDC ID token. The app verifies it (see App requirements).

Header:

```json
{
  "typ": "atproto-id+jwt",
  "alg": "<signing algorithm>",
  "kid": "<did>#atproto"
}
```

Payload, with exactly these claims:

| Claim       | Value                                                                        |
| ----------- | ---------------------------------------------------------------------------- |
| `iss`       | The account's DID.                                                           |
| `sub`       | The account's DID, the same as `iss` (self-issued).                          |
| `aud`       | The app's `client_id`.                                                       |
| `nonce`     | The nonce from `params`.                                                     |
| `iat`       | Issue time, in seconds.                                                      |
| `exp`       | `iat` + 60 seconds.                                                          |
| `auth_time` | When the account last signed in with a password on this browser, in seconds. |

The token is signed with the account's atproto signing key (the `#atproto` verification method in its DID document). The IdP's own key is not involved, so the token proves what the account's key holder said, not what an authorization server vouches for (see Open questions).

The response has no `continue_on`.

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
    providers: [
      {
        configURL: '<issuer>/oauth/fedcm/config.json',
        clientId,
        params: { response_type: 'id_token', nonce },
      },
    ],
  },
})
```

Registered provider (Chrome experimental):

```js
providers: [
  {
    configURL: 'any',
    type: 'https://atproto.com',
    clientId,
    params: { response_type: 'id_token', nonce },
  },
]
```

- `clientId` **must** be the app's atproto OAuth `client_id`. The page's origin must match it, as described in the assertion checks.
- `params` **must** be exactly the object shown, with a fresh, unguessable `nonce` (1 to 256 characters) generated for this request. Keep the nonce to check the token.
- An app may combine explicit config URLs with the `any` entry.
- `passive` mode can run on page load. `active` mode must be called directly from a user's click, and Chrome then allows exactly one provider entry (`any` counts as one).
- If the app asks for `any` and no IdP is registered, Chrome rejects with an error. Apps must treat that like any other FedCM failure.

### Handling the result

The browser returns an `IdentityCredential` with `configURL` and `token`.

1. **Check `configURL`.** For a configured provider, it must be one the app requested. For a registered provider the app can't know it in advance, so it must at least be https.
2. **Verify the token.** Reject it unless all of these hold:
   - the header `typ` is `atproto-id+jwt`, and `kid` is `<did>#atproto` for the DID in `sub`;
   - `iss` equals `sub`, and `sub` is a valid DID;
   - `aud` equals the app's `client_id`;
   - `nonce` equals the nonce the app sent for this request;
   - `exp` is in the future (allow a little clock skew) and `iat` is not in the future beyond that skew;
   - the signature verifies against the `#atproto` verification method of the DID document, resolved by the app (not taken from the token or the IdP). The app resolves the DID document itself and requires its `id` to equal `sub`.
3. **Use the result.**
   - To only authenticate the user, the verified token is enough: `sub` is the signed-in DID. The app should still resolve and display the handle. It gets no access to the account's data.
   - To access the account, run atproto OAuth for `sub`. Resolve the DID to its PDS and authorization server as usual, and start OAuth with the DID as the sign-in hint (`login_hint`). Apps should also check that the authorization server's issuer origin matches the origin of `configURL`. The prototype example doesn't do this yet. When OAuth completes, the app **must** complete atproto OAuth's [identity authentication](https://atproto.com/specs/oauth#identity-authentication) checks before trusting `sub`. It resolves the DID document and takes the declared PDS, confirms through the PDS's resource server metadata that the PDS points to the authorization server bound to this session, and confirms that the authorization server metadata's `issuer` matches that server's origin. atproto OAuth client libraries such as `@atproto/oauth-client` already do this. FedCM doesn't change or replace it. In addition, `sub` **must** equal the DID in the verified token. Otherwise reject the session.
4. **Fall back.** On any FedCM error, rejection, or dismissal, show the normal handle sign-in.

The token is not intended as a bearer credential. It authenticates the user to the app that requested it, and only that app (`aud`, a `client_id` URL) should accept it. It is signed by the same `#atproto` key as atproto service-auth JWTs, and is distinguished only by `typ: atproto-id+jwt` and by `aud` not being a DID. Services that verify atproto JWTs must check `typ` and `aud` (and should reject `typ` `atproto-id+jwt`).

## Security and privacy considerations

- **Check the nonce.** The nonce binds the token to the request that asked for it. An app that doesn't check it can be fed a token that was issued for another request.
- **Verify where you consume the token.** Verify the token in the code that trusts it, against a DID document the app resolved itself. If a backend accepts the token, it should verify it again and not rely on the page's word. The token lives 60 seconds and has no replay protection beyond the nonce, so a backend must also bind the nonce to its own session.
- **A signed token needs a live sign-in.** The IdP signs only for accounts eligible on this browser, and reports `auth_time` so an app can apply its own freshness policy.
- **Malicious registered providers (Chrome experimental).** Registration is silent, so any site can register itself with type `https://atproto.com`, push a fake account, and answer with its own DID. Its authorization server can then approve OAuth, and the app's checks pass, because `sub` really is that DID and its DID document really points to the attacker's PDS and authorization server. The user ends up signed in to the app as the attacker's account (login CSRF that needs the user's click). Apps should show the signed-in handle clearly. The `configURL`-to-issuer check limits inconsistent providers, not malicious ones.
- **No email addresses.** The IdP never sends email addresses to the browser. Pushed accounts carry `@handle` in Chrome's required `email` field.
- **Pushed accounts expire** after the authentication max age, unless the IdP pushes again.
- **What the assertion endpoint reveals:** to a validated client, whether a DID is signed in on this browser, as a signed token or a `login_required` refusal. The browser only calls it for accounts it already listed.
- **The IdP learns which app the user picked an account for.** It would learn the same through OAuth.

## Not part of the interoperability contract

These are details of this implementation that other IdPs may do differently:

- **Cookies.** The prototype keeps FedCM-only copies of its device and session cookies (`fedcm-dev-id`, `fedcm-ses-id`; `Secure`, `HttpOnly`, `SameSite=None`, `Path=/oauth/fedcm`), so its normal cookies can stay `SameSite=Lax` or `Strict`.
- **Browser session state.** The prototype identifies the browser by its FedCM device cookie and computes eligibility per device.
- **Login URL details:** its path and the `fedcm=true` query.
- **How IdP pages learn what to push:** server-rendered data, in this implementation.
- **Enabling FedCM on the PDS:** `PDS_OAUTH_FEDCM_ENABLED`, and `PDS_OAUTH_FEDCM_ALLOW_LOOPBACK_CLIENTS` for development.

## Open questions

- **Config discovery.** Keep the fixed config path, or advertise the config URL in authorization server metadata?
- **Issuer check.** Should the `configURL`-to-issuer check be a requirement for apps rather than a recommendation?
- **Pushed `email`.** Keep `@handle` in `email`, or wait for a first-class handle field in Chrome?
- **Authentication token issuer.** The token is shaped like an OIDC ID token but signed with the account's atproto signing key, with `iss` = `sub` = the account's DID (self-issued), so it doesn't name the authorization server. One alternative keeps the user's signature and sets `iss` to the authorization server's issuer, binding the token to it; apps would then check that `iss` is the DID's authorization server. Should the token name the authorization server?
- **Identity providers without the signing key.** The token is signed with the account's atproto signing key, which the account's PDS holds. When the identity provider (the authorization server) is a separate service from the PDS, it may not hold that key. How should it mint the token? For example, it might ask the PDS to mint one over a trusted channel it has with the PDS. The prototype mints tokens only where the identity provider and the PDS are the same service.
- **Authorization through FedCM.** A `request_uri` (pushed authorization request) in `params` is reserved for a future mode where FedCM starts OAuth authorization. Today the assertion refuses any other `params`.
- **The handle-based IdP Registration spec.** The current [IdP Registration](https://w3c-fedid.github.io/idp-registration/) draft has moved to handles (`register(handle)`, `federation`, signed handle-verification tokens), which Chrome doesn't implement yet. Registered-provider behavior here follows Chrome's implementation and will change if Chrome adopts the spec.
