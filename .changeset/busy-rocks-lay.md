---
'@atproto/lex-client': minor
'@atproto/lex': minor
---

**Breaking:** Rework the `Client` class and its `service` / `labelers` options to give callers full control over the `atproto-proxy` and `atproto-accept-labelers` request headers.

A single `Client` can now be configured to talk to a proxied service (e.g. an AppView) by default, while still being able to reach other services — including the user's PDS directly — on a per-request basis. This is the foundation for SDK-style `Action`s that compose AppView and PDS calls through a single client instance.

- The `service` and `labelers` options set on a `Client` now act as _defaults_ for that client's requests. Per-request options merge with those defaults using conventional option-merging semantics: `undefined` (or omitted) inherits the client's default, while a defined value replaces it (**breaking:** previously, per-request `labelers` were appended to the client's, and a per-request `service` could not unset the client's).
- `service: null` and `labelers: null` can now be passed on a per-request basis to opt out of the client's defaults, sending the request without the `atproto-proxy` or `atproto-accept-labelers` header.
- **Breaking:** The record helper methods (`create()`, `get()`, `put()`, `delete()`, `list()`, `listAll()`, `createRecord()`, `getRecord()`, `putRecord()`, `deleteRecord()`, `listRecords()`, `applyWrites()`, `uploadBlob()`, `getBlob()`) now always target the user's PDS: they default to `service: null` and `labelers: null`, ignoring the client's instance-wide defaults (unless explicitly overridden through their options).
- **Breaking:** `Client` no longer implements the `Agent` interface (its `fetchHandler` method was removed), meaning that a `Client` can no longer be used as the agent of another `Client`. To share authentication between differently-configured clients, build them from the same session, or reuse an existing client's `agent` (`new Client(otherClient.agent, { ... })`).
- Static app labelers (`Client.appLabelers`, configured via `Client.configure()`) are still always applied — with the `;redact` param — and can now be overridden per client instance or per request through the new `appLabelers` option (`appLabelers: null` disables them).
- An `atproto-proxy` header provided through the `Client` constructor's `headers` option is now used as a fallback for the `service` option, making the two equivalent at the client level. A per-request `service` value (including `null`) always takes precedence. Per-request `atproto-proxy` headers are ignored by `Client` methods (use the `service` option instead), while `atproto-accept-labelers` headers are merged with the labelers from the `labelers` and `appLabelers` options (unless `labelers: null` is used).
