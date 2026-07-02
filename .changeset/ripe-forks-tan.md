---
'@atproto/lex-client': minor
'@atproto/lex': minor
---

Rework the `service` and `labelers` options of `Client` and `xrpc()` to give callers full control over the `atproto-proxy` and `atproto-accept-labelers` request headers:

- The `service` and `labelers` options set on a `Client` now act as _defaults_ for that client's requests. Per-request options merge with those defaults using conventional option-merging semantics: `undefined` (or omitted) inherits the client's default, while a defined value replaces it (previously, per-request `labelers` were appended to the client's, and a per-request `service` could not unset the client's).
- `service: null` and `labelers: null` can now be passed on a per-request basis to opt out of the client's defaults, allowing requests to be sent without the `atproto-proxy` or `atproto-accept-labelers` headers.
- When a `Client` is used as the agent of another `Client`, the `service` and `labelers` configurations of the two clients are no longer mixed together; only the request-initiating client's configuration applies. Custom (non `atproto-*`) default headers still propagate from the base client. The one exception is static `appLabelers` (configured via `Client.configure()`), which are always applied with the `;redact` param, including across composed clients.
- `atproto-*` headers are now reserved: values provided through the `headers` option (on the client or per request) are ignored. Use the dedicated `service` and `labelers` options instead.
