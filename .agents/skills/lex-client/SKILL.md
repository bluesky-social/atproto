---
name: lex-client
description: >
  Call AT Protocol XRPC services with the `Client` from `@atproto/lex`. Use
  when making an authenticated or unauthenticated HTTP request to an XRPC
  service, wiring one service to call another, logging in with OAuth or an app
  password, reading or writing repository records, uploading or fetching blobs,
  configuring headers, labelers, service proxying, retries, or request/response
  validation, handling XRPC errors, or composing reusable client actions. Also
  use when replacing `AtpAgent`, `XrpcClient`, or a hand-rolled `fetch` call to
  an `/xrpc/` endpoint. For a full migration off the legacy client stack, use
  the lexification-client skill.
disable-model-invocation: false
---

# high-level XRPC client

`Client` wraps an authenticated (or anonymous) session with helpers for AT Proto
repo operations (`create`, `get`, `put`, `delete`, `list`, `listAll`,
`applyWrites`, `uploadBlob`, `getBlob`) plus the low-level
`call`/`xrpc`/`xrpcSafe` request methods. Reach for it whenever there is a
session to carry, or per-service config (headers, labelers, proxy target) worth
encapsulating.

The standalone `xrpc()` / `xrpcSafe()` exports exist for one-off, session-less
calls. Their first argument is an `Agent | AgentOptions` — a URL string, `URL`,
`AgentConfig` object, or bare `FetchHandler` — and they otherwise share the same
options, responses, and errors as the client methods.

```ts
import { xrpc } from '@atproto/lex'

await xrpc(hostUrl, com.atproto.sync.requestCrawl, { body: { hostname } })
```

## Constructing

The constructor takes an `Agent` (anything with `fetchHandler`, optionally
`did`) or `AgentOptions` (a URL string/`URL`, or an `AgentConfig`).

```ts
import { Client } from '@atproto/lex'

// Unauthenticated
const client = new Client('https://public.api.bsky.app')

// OAuth — OAuthSession implements Agent
import { type OAuthSession } from '@atproto/oauth-client-node'
const session: OAuthSession = await oauthClient.restore(userDid)
const client = new Client(session)
```

### App password sessions (CLI / scripts / bots)

`PasswordSession` also implements `Agent`, plus `AsyncDisposable` — prefer
`await using` so the session is deleted server-side on scope exit.

```ts
import {
  LexAuthFactorError,
  PasswordSession,
} from '@atproto/lex-password-session'

// Credentials as a single URL: https://<handle>:<app-password>@<pds-host>
await using session = await PasswordSession.login(
  process.env.APP_PASSWORD_CREDENTIALS,
)
const client = new Client(session)
```

Long-lived apps should persist session data via `onUpdated` and use
`PasswordSession.resume(data, options)` on the next run rather than re-sending
credentials. Other statics: `createAccount(body, { service, ... })` and
`delete(data)` (revoke stored session data without resuming it). `login` throws
`LexAuthFactorError` when the account requires 2FA — catch it, prompt, and retry
with `authFactorToken`.

### Server-side calls with a static credential

No session needed — put the credential in the constructor headers. Internal
services typically also relax response processing:

```ts
const client = new Client(
  {
    service: config.serviceUrl,
    headers: { authorization: `Bearer ${config.serviceApiKey}` },
  },
  // Trust internal services to send well-formed responses
  { strictResponseProcessing: false, validateResponse: config.devMode },
)
```

If the credential or URL must be resolved per-request, supply a custom agent:

```ts
const agent: Agent = {
  get did() {
    return undefined
  },
  async fetchHandler(path, init) {
    const { serviceUrl, serviceApiKey } = await getConfig()
    const headers = new Headers(init?.headers)
    headers.set('authorization', `Bearer ${serviceApiKey}`)
    return fetch(new URL(path, serviceUrl), { ...init, headers })
  },
}

const client = new Client(agent)
```

`AgentConfig` and `fetchHandler` are mutually exclusive — passing both throws a
`TypeError`.

### Service proxying, and one client for several services

`service` and `labelers` set the `atproto-proxy` / `atproto-accept-labelers`
headers. Both are _defaults_ and are overridable per request, so a single
AppView-configured client can still reach the user's PDS directly — pass `null`
to suppress the header for that request.

```ts
const client = new Client(session, {
  service: 'did:web:api.bsky.app#bsky_appview',
  labelers: ['did:plc:labeler1', 'did:plc:labeler2'],
})

// Proxied to the AppView (client default)
await client.call(app.bsky.feed.getTimeline)

// Straight to the user's PDS
await client.xrpc(com.atproto.repo.getRecord, {
  service: null,
  labelers: null,
  appLabelers: null,
  params: { repo: client.assertDid, collection, rkey: 'self' },
})
```

The record helpers (`create`, `get`, `put`, `delete`, `list`, `listAll`,
`*Record`, `applyWrites`, `uploadBlob`, `getBlob`) already default to
`service: null` / `labelers: null`, since repo operations belong on the PDS. Set
them explicitly to proxy one.

## Validation options

```ts
const client = new Client(session, {
  // Validate request bodies against the input schema before sending. Worth
  // enabling in dev/test to catch schema mistakes at the source.
  validateRequest: true, // default: false

  // Validate response bodies against the output schema.
  validateResponse: false, // default: true

  // Strict Lex decoding. `false` accepts legacy blobs, datetimes without
  // timezones, etc. — see the lex-schema skill.
  strictResponseProcessing: false, // default: true
})
```

All three are overridable per-call on `call` / `xrpc` / `xrpcSafe`.

## Authentication accessors

```ts
client.did // DidString | undefined
client.assertAuthenticated() // throws if unauthenticated; narrows client.did
client.assertDid // DidString (throws if unauthenticated)
```

`assertAuthenticated()` is an assertion function, so TypeScript requires the
receiver to have an explicit type annotation. `const client = new Client(...)`
(inferred) will fail with TS2775 — write `const client: Client = new Client(...)`
or annotate the parameter.

## Requests

### `client.call()` — returns the body, throws on failure

```ts
import { app } from './lexicons/index.js'

const profile = await client.call(app.bsky.actor.getProfile, {
  actor: 'pfrazee.com',
})

await client.call(app.bsky.feed.sendInteractions, { interactions })

const timeline = await client.call(
  app.bsky.feed.getTimeline,
  { limit: 50 },
  { signal, maxRetries: 3, headers: { 'custom-header': 'value' } },
)
```

The input argument is positional and distinct from the options: for a query it
is the `params`, for a procedure the body, for an action the input. Methods that
take neither can be called with the schema alone, but **the options must never
occupy the input slot** — `client.call(schema, options)` sends `options` as
query parameters and fails validation. Use `client.call(schema, {}, options)`,
or `client.xrpc(schema, options)`.

### `client.xrpc()` — full response

```ts
const response = await client.xrpc(app.bsky.feed.getTimeline, {
  params: { limit: 50 },
  signal,
  headers: { 'custom-header': 'value' },
})
response.status
response.headers.get('content-language')
response.body
```

Unlike `call`, `xrpc` takes a single options object with `params` / `body` as
named fields, so options-only calls are unambiguous.

### `client.xrpcSafe()` — discriminated result

Same request as `xrpc()`, but returns the failure instead of throwing:

```ts
const result = await client.xrpcSafe(com.atproto.identity.resolveHandle, {
  params: { handle: 'alice.bsky.social' },
})
if (result.success) {
  result.body
} else if (result.matchesSchemaErrors()) {
  result.error // narrowed to the errors declared by the schema
} else {
  throw result.reason
}
```

### Errors

All failures extend `XrpcError` (`error`, `message`, `matchesSchemaErrors()`,
`shouldRetry()`). The three concrete branches of `XrpcFailure`:

| Class                      | Meaning                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| `XrpcResponseError`        | Server returned a non-2xx status                                        |
| `XrpcInvalidResponseError` | Response is non-compliant — unexpected status, wrong encoding, bad data |
| `XrpcInternalError`        | Failed before a usable response existed (network, client)               |

Subclasses worth narrowing on: `XrpcAuthenticationError` (401, exposes
`wwwAuthenticate`), `XrpcResponseValidationError` (response failed schema
validation), and `XrpcFetchError` (the underlying `fetch` threw — the retryable
internal error).

Only `XrpcResponseError` carries HTTP data. `status`, `headers`, and `body` do
**not** exist on the `XrpcFailure` union, so narrow first:

```ts
if (!result.success && result instanceof XrpcResponseError) {
  result.status
  result.headers.get('retry-after')
}
```

### Retries

`call`, `xrpc`, `xrpcSafe`, and the standalone functions all retry internally.
Set `maxRetries` (default `0`); tune with `minRetryTimeout` (500ms),
`maxRetryTimeout` (30s), `retryTimeoutFactor` (2), `retryHeaders` (honour
`Retry-After` / `RateLimit-Reset`, default `true`), or replace the predicate with
`retry(failure, { counter })`. The defaults already cover the retryable status
codes (408, 425, 429, 5xx) and network errors, so do not wrap calls in a manual
retry loop.

## Records

### `create` / `get` / `put` / `delete`

```ts
import { currentDatetimeString } from '@atproto/lex'

const { uri, cid } = await client.create(app.bsky.feed.post, {
  text: 'Hello, world!',
  createdAt: currentDatetimeString(),
})

// Literal-key records (profile is rkey 'self') need no rkey
const profile = await client.get(app.bsky.actor.profile)
profile.value.displayName

const post = await client.get(app.bsky.feed.post, { rkey: '3jxf7z2k3q2' })

await client.put(app.bsky.actor.profile, { displayName: 'New Name' })
await client.delete(app.bsky.feed.post, { rkey: '3jxf7z2k3q2' })
```

`rkey` is optional for `literal:` and auto-generated (`tid`) keys and required
otherwise; the type system enforces this, so a missing `rkey` shows up as a
compile error rather than a runtime one. Shared options: `validate` (ask the PDS
to validate), `validateRequest` (validate locally before sending), `swapCommit`
(optimistic concurrency on the commit CID), and for `put`/`delete` also
`swapRecord` (on the record's own CID).

### `list` / `listAll` — paginating a collection

Listed records are a discriminated union on `valid`: entries that fail schema
validation still come back, with `value` widened to `LexMap`. Check `valid`
before touching typed fields.

```ts
const page = await client.list(app.bsky.feed.post, { limit: 50, reverse: true })
for (const record of page.records) {
  if (record.valid) console.log(record.uri, record.value.text)
}
if (page.cursor) {
  await client.list(app.bsky.feed.post, { cursor: page.cursor, limit: 50 })
}
```

`listAll()` is the auto-paginating async generator — prefer it over hand-rolling
a cursor loop. It defaults to `maxRetries: 3` since a long walk is far more
likely to hit a transient failure:

```ts
for await (const record of client.listAll(app.bsky.feed.post)) {
  if (record.valid) console.log(record.value.text)
}
```

### `applyWrites` — atomic batch writes

All ops succeed or fail together. Options: `repo` (defaults to `client.did`),
`validate`, `swapCommit`.

```ts
const response = await client.applyWrites((op) => [
  op.create(app.bsky.feed.post, {
    text: 'Hello!',
    createdAt: currentDatetimeString(),
  }),
  op.update(app.bsky.actor.profile, { displayName: 'Alice' }),
  op.delete(app.bsky.feed.post, { rkey: '3jxf7z2k3q2' }),
])
```

`response.body.results` is **optional**, and is a union in which `deleteResult`
has no `uri` or `cid`. Narrow before reading them:

```ts
for (const result of response.body.results ?? []) {
  if (com.atproto.repo.applyWrites.createResult.$isTypeOf(result)) {
    console.log(result.uri, result.cid)
  }
}
```

The callback may also be a generator, which reads better for dynamic batches:

```ts
await client.applyWrites(function* (op) {
  for (const rkey of staleRkeys) yield op.delete(app.bsky.feed.post, { rkey })
})
```

### Blobs

```ts
const { body } = await client.uploadBlob(bytes, { encoding: 'image/png' })
body.blob // BlobRef — store this in a record

const image = await client.getBlob(did, cid)
```

## Labelers

```ts
// Process-global defaults, always sent with `;redact`
Client.configure({ appLabelers: ['did:plc:labeler1'] })

// Per-client, and mutable at runtime
const client = new Client(session, { labelers: ['did:plc:labeler3'] })
client.addLabelers(['did:plc:labeler4'])
client.setLabelers(['did:plc:labeler5'])
client.clearLabelers()
```

Pass `appLabelers: null` on a request to drop the process-global ones. The usual
post-login flow reads the user's preference:

```ts
const { preferences } = await client.call(app.bsky.actor.getPreferences)
const pref = preferences.findLast(app.bsky.actor.defs.labelersPref.$isTypeOf)
client.setLabelers(pref?.labelers.map((l) => l.did) ?? [])
```

## Actions — composable client operations

An `Action<Input, Output>` is `(client, input, options) => Output | Promise<Output>`.
`client.call()` accepts one anywhere a schema fits, so an action is
interchangeable with a lexicon method at the call site.

```ts
import { type Action, Client, currentDatetimeString } from '@atproto/lex'
import { app } from './lexicons/index.js'

type LikeInput = { uri: AtUriString; cid: CidString }

export const likePost: Action<LikeInput, CreateOutput> = async (
  client: Client, // explicit — required by assertAuthenticated() below
  { uri, cid },
  options,
) => {
  client.assertAuthenticated()
  return client.create(
    app.bsky.feed.like,
    { subject: { uri, cid }, createdAt: currentDatetimeString() },
    options,
  )
}

await client.call(likePost, { uri, cid })
```

Actions compose — thread `options` through so cancellation propagates:

```ts
const upsertPreference: Action<Preference, Preference[]> = async (
  client,
  pref,
  options,
) => {
  const { preferences } = await client.call(
    app.bsky.actor.getPreferences,
    {},
    options,
  )
  options?.signal?.throwIfAborted()
  const updated = [...preferences.filter((p) => p.$type !== pref.$type), pref]
  await client.call(
    app.bsky.actor.putPreferences,
    { preferences: updated },
    options,
  )
  return updated
}
```

Export actions individually rather than as one object, so consumers tree-shake
what they don't call:

```ts
// actions.ts
export const post: Action</* ... */> = async (c, i, o) => {/* ... */}
export const follow: Action</* ... */> = async (c, i, o) => {/* ... */}

// usage
import * as actions from './actions.js'
await client.call(actions.post, { text: 'Hello!' })
```

Guidelines: annotate as `Action<Input, Output>` (it contextually types the
parameters); call `client.assertAuthenticated()` when auth is required;
`options?.signal?.throwIfAborted()` between long steps; and handle swap-error
retries here rather than pushing optimistic-concurrency handling onto callers.

## Related skills

- **[lex-schema](../lex-schema/SKILL.md)** — the generated schemas passed to
  every client method, and `$isTypeOf` / `$build` / `$type`.
- **[lex-data](../lex-data/SKILL.md)** — blobs, CIDs, branded strings, and
  datetimes at the call boundary.
- **[lexification-client](../lexification-client/SKILL.md)** — migrating from
  `AtpAgent` / `XrpcClient`.
- **[xrpc-server](../xrpc-server/SKILL.md)** — the other half, when the service
  also _serves_ XRPC routes.
- **[lex-setup](../lex-setup/SKILL.md)** — installing lexicons and configuring
  the codegen that produces `./lexicons/index.js`.
