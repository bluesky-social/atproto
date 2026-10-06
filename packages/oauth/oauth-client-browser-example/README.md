# OAuth browser example

Run `pnpm dev` from this directory to serve the example at
`http://127.0.0.1:8080`. The development environment defaults to the local
dev-env services. Explicit endpoint query parameters can target another test
environment.

## Account-first FedCM

FedCM is enabled only when the URL contains at least one `fedcm_provider`
configuration URL. Repeat the parameter to include a controlled second provider:

```text
http://127.0.0.1:8080/?env=development&fedcm_provider=https%3A%2F%2Fidp-one.test%2Foauth%2Ffedcm%2Fconfig.json&fedcm_provider=https%3A%2F%2Fidp-two.test%2Foauth%2Ffedcm%2Fconfig.json
```

Use an HTTPS PDS with FedCM enabled. This loopback example additionally requires
the PDS's development-only loopback-client allowance; see the
[PDS configuration](../../pds/README.md#fedcm-prototype).

The example initializes its OAuth client, then asks for a passive FedCM chooser
with required mediation. No PAR is sent until the user chooses an account.
A valid DID result starts one ordinary OAuth redirect flow. The selected DID is
preserved through the callback, and a different authenticated OAuth subject is
reported explicitly. An unsupported browser, dismissal, or a non-DID result
from another provider leaves the handle-entry flow available.

The ordinary OAuth client may retry a PAR POST after a DPoP nonce challenge;
this still creates one pushed authorization request for the selected account.

To use explicit active FedCM instead, add `fedcm_mode=active` to the URL. The
page shows a **Choose an account** button and opens FedCM only from that genuine
user click, preserving the browser's transient user activation. Active mode
requires exactly one `fedcm_provider`; multiple configured providers show an
error and cannot start a request. The selected DID still goes through the same
validation and account-first OAuth flow, with no PAR sent before selection.

Provider URLs are explicit configuration, not decentralized IdP discovery.
FedCM tokens in this prototype are DID hints, not identity credentials or OAuth
access tokens. Do not use them to authenticate a relying-party session.

## Browser validation

The PDS browser suite uses its real OAuth provider and this example together
with a controlled second provider. It runs only when
`PUPPETEER_EXECUTABLE_PATH` points to Chrome 141 or later; Puppeteer's pinned
Chrome is older. OpenSSL is used to create a temporary self-signed test
certificate. The test launches Chrome with local host-resolution rules and
certificate validation disabled for the fixture.

Build the changed packages from their respective directories first:
`oauth-provider-ui`, `oauth-provider`, `oauth-client-browser-example`, and `pds`.
Then run from `packages/pds`:

```sh
PUPPETEER_EXECUTABLE_PATH='/path/to/chrome' pnpm test:sqlite tests/fedcm.test.ts --runInBand
```

The suite checks five accounts across two IdPs, cancellation, selection of the
other provider, and our DID's assertion followed by exactly one PAR and ordinary
OAuth authorization. It also checks the login-status transition when signing
out one account versus the last remembered accounts, cancellation during PAR,
and rejection of a differing OAuth subject.
It also exercises Chrome's sign-in window when browser login status outlives
the provider session, including remembered login and popup closure.
Active-mode cases check click-triggered selection, retry after dismissal or
cancellation, and rejection of multiple configured providers.
