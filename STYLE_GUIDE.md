# Style guide

Code conventions for this repository. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the process around issues and pull requests.

Prettier (`pnpm run style`) and ESLint (`pnpm run lint`) enforce what can be enforced mechanically. The rules below are the conventions followed by this repo and are not enforced by tooling.

## Modules and imports

- ESM only — every package ships `"type": "module"`.
- **Always import explicitly**; never rely on globals (e.g. no global `React`). The only exception is jest's ambient test globals.
- Prefer named imports over namespace or barrel imports: `import { useEffect } from 'react'`, not `import * as React from 'react'`.
- **Relative imports carry an explicit `.js` extension**, even from a `.ts` source: `import { httpLogger } from './logger.js'`. ESLint's `import/extensions` rule is deliberately off, so nothing catches a missing extension for you.
- **Prefer named exports over `export default`.** Only use a default export when something outside your control requires it (a `vite.config.ts`, a framework's route convention, …).

## Naming

- **Files are kebab-case**: `lex-error.ts`, `write-operation-builder.ts`, `input-new-password.tsx`.
- **Exception — XRPC route handlers.** Under `src/api/**` in the service packages, the file name mirrors the lexicon method name and is therefore camelCase: [packages/bsky/src/api/app/bsky/feed/getAuthorFeed.ts](./packages/bsky/src/api/app/bsky/feed/getAuthorFeed.ts).
- **Exception — React components.** A file exporting a single component may be named after it, in PascalCase (`ProfileCard.tsx`).

## TypeScript

- **Type explicitly where types originate, rely on inference everywhere else.** Annotate public API surfaces: exported functions, class members, and module-level constants whose type isn't obvious.
- Never re-annotate what the call site already provides. `expressApp.use((...args) => …)` and `onChange={(event) => …}` need no parameter or return type annotations — TypeScript infers them from the expected callback type.
- **Prefer `export function` over an arrow function assigned to a const.** Function declarations support overload signatures, which arrow consts cannot express.

## Comments

- **Write for an experienced developer.** A comment earns its place by explaining something the code can't: a non-obvious invariant, a subtle edge case, a workaround for an upstream bug, or _why_ a counter-intuitive approach was chosen.
- **Keep them short.** One or two lines is usually enough. Don't write a tutorial where a sentence suffices.
- **Delete comments that restate the code.** `// increment the counter` above `counter++` is noise. Remove such comments when you touch the surrounding code.
- **Mark explanatory comments with `@NOTE` and deferred work with `@TODO`.** These two annotations are the only ones used in this repo — no `FIXME`, no `HACK`, and no bare `TODO:`.

  ```ts
  // @NOTE keep in sync with same interface in bsky/src/image/invalidator.ts
  // @TODO drop dependency on uint8arrays package once Uint8Array.fromBase64 lands
  ```

- **Document public APIs with JSDoc**: a short description and, where it helps, an `@example` block. Don't restate parameter and return types — TypeScript already carries those. Reserve `@param` / `@returns` for saying something the signature doesn't.

## Dependencies

- Don't add new dependencies without strong justification.
- Reference internal packages with the workspace protocol (`workspace:^`); never pin them to a published version.
- `@atproto/api` is being replaced by `@atproto/lex`. Never add `@atproto/api` as a new dependency; use the `@atproto/lex` family instead. It remains in use in [packages/ozone](./packages/ozone/) and in some test suites (`pds`, `bsky`, `dev-env`) — keep using it there until those are migrated.
- **No new circular dependencies**, explicit or implicit. The only tolerated cycle is `pds` ↔ `bsky` in tests. This applies to comments too: a dependency package must never reference an implementation detail of a package that depends on it.

## Errors

- Custom error classes are suffixed `Error` and declare `name` as a class field matching the class name, so the name is set once at the declaration rather than in every constructor:

  ```ts
  export class XrpcResponseError extends XrpcError {
    name = 'XrpcResponseError'
  }
  ```

  Older packages predate this and omit the field — follow the convention in new code rather than propagating the old shape.

## Lexicons

- **Never write NSID string literals** in a package that uses `@atproto/lex`. Import the generated schema and use the constant it exposes:

  | Lexicon definition               | Use                                     |
  | -------------------------------- | --------------------------------------- |
  | record / typed object            | `app.bsky.feed.post.$type`              |
  | query / procedure / subscription | `app.bsky.feed.getPosts.$lxm`           |
  | token                            | `app.bsky.feed.defs.requestLess.$token` |

  Each constant is emitted once per schema, so every reference shares one string instance instead of duplicating the literal at each call site — and the schema stays the single source of truth.

## Logging

- Never instantiate a logger inline. Each package declares its loggers as exported constants in its own `src/logger.ts`, built with `subsystemLogger('<package>:<subsystem>')`, and imports them where needed.

## Telemetry

We use OpenTelemetry for tracing, metrics and logs.

Each service package (`pds`, `ozone`, `bsky`, etc.) should define its own **optional** telemetry setup (e.g. `src/telemetry.ts`, exposed through the `package.json` `exports` field), loaded ahead of the service entry point: `node --import @atproto/<package>/telemetry <service>.js`. Importing the telemetry module initializes the OTEL SDK and registers instrumentations, but does not start the service itself. The generic SDK bootstrap is factored into [`@atproto-labs/opentelemetry-node`](./packages/internal/opentelemetry-node): a service's telemetry module calls its `setup()` helper and supplies only the service-specific parts (its name/version and extra instrumentations). [packages/pds/src/telemetry.ts](./packages/pds/src/telemetry.ts) is the reference implementation.

[`@atproto-labs/opentelemetry-node`](./packages/internal/opentelemetry-node)'s `setup()` handles the concerns shared by every service:

- Builds on `@opentelemetry/sdk-node`'s `NodeSDK`, so the setup is fully (and automatically) configurable through the standard `OTEL_*` environment variables:
  - [https://opentelemetry.io/docs/languages/sdk-configuration/general/](https://opentelemetry.io/docs/languages/sdk-configuration/general/)
  - [https://opentelemetry.io/docs/languages/sdk-configuration/otlp-exporter/](https://opentelemetry.io/docs/languages/sdk-configuration/otlp-exporter/)
- Is **opt-in through exporter endpoints**, not a bespoke flag. Configuring an OTLP endpoint is what enables the SDK:
  - `OTEL_EXPORTER_OTLP_ENDPOINT` set alone enables traces, metrics and logs.
  - `OTEL_EXPORTER_OTLP_<SIGNAL>_ENDPOINT` overrides the endpoint for one signal; set without the generic endpoint, it enables only that signal.
  - `OTEL_<SIGNAL>_EXPORTER=none` disables a signal, even when other exporter names or a signal endpoint are also configured.
  - `OTEL_SDK_DISABLED` remains a kill switch, per spec.
  - A signal the operator did not opt into exports **nothing** — it does not let `NodeSDK` fall back to its default OTLP pipeline on `http://localhost:4318`.
- Uses `@opentelemetry/auto-instrumentations-node`'s `getResourceDetectors` for resource detection (honours `OTEL_NODE_RESOURCE_DETECTORS` and `OTEL_RESOURCE_ATTRIBUTES`, and includes the `container` detector), and sets default resource attributes (service name, version, `atproto` namespace, and deployment environment) that the service may extend or override through the `defaultResourceAttributes` option.
- Shuts down gracefully: listens for the process `beforeExit` event and calls `sdk.shutdown()` to flush pending telemetry. This works because services exit by emptying the event loop (below).

`setup()` already installs the instrumentations shared by every atproto service (`getDefaultAtprotoInstrumentations()`): the Node runtime, HTTP, Express, Undici and Pino instrumentations. These bring:

- **Low-cardinality span names and `http.route`.** XRPC request spans (incoming and outgoing) are named after the normalized method NSID (`POST /xrpc/com.atproto.server.createSession`), never the raw URL, and carry an `xrpc.method` attribute. This is derived internally from the request path — services get it for free and don't wire it up themselves.
- **Log correlation without log forwarding.** The Pino instrumentation is registered with `disableLogSending: true`: `trace_id`/`span_id` are injected into every pino record, but records are _not_ shipped to the OTEL stack as log records. Only what a service emits deliberately through the OTEL Logs API — from `events.ts` — reaches the OTEL log stream. (Blanket log forwarding is intentionally not exposed by `setup()` today.)

Each service's telemetry module supplies only what is specific to it — its name and version, and (via the `instrumentations` option) any **extra** instrumentations for packages that service actually uses (e.g. `opentelemetry-plugin-better-sqlite3` for services on `better-sqlite3`) rather than `getNodeAutoInstrumentations()`. Whenever adding a dependency, add the corresponding instrumentation if one exists.

The service itself should:

- Not run its own metrics endpoint (e.g. a hand-rolled Prometheus server); metrics leave the process only through the SDK's env-configured exporters.
- **Never read the `OTEL_*` environment variables.** Telemetry configuration belongs entirely to the telemetry script; service code interacts with the telemetry stack only through the `@opentelemetry/api*` packages, primarily via its `events.ts` module.
- Not use `process.exit()` to terminate the process. Instead, release all resources so the event loop empties and the process exits naturally (`process.exitCode` can be set to indicate the exit code). Killing the process would drop unflushed telemetry.
- Define an `events.ts` module as the single place where business events are reported, using Meters (`@opentelemetry/api`) and Logs (`@opentelemetry/api-logs`):
  - One helper per event, so each event has exactly one call-site shape and the counter, log record and attribute definitions live together instead of drifting across handlers.
  - The meter and logger are named after the package (`metrics.getMeter('@atproto/pds')`).
  - Counters carry **low-cardinality attributes only**; high-cardinality detail (`did`, `clientId`, …) goes into the log record.
  - Each event is written to both the package's pino logger — so events reach stdout even when OTEL export is disabled — and the OTEL Logs API, which is what reaches the OTEL stack (pino log records are not forwarded; see above).
  - Helpers never throw. When no exporter is configured the OTEL calls are no-ops, so emitting events is always safe and essentially free — and log records emitted within an active span are trace-correlated automatically.

Here is an example of service entry point:

```ts
// packages/my-service/src/index.ts
import { once } from 'node:events'

type ServiceConfig = {
  // ...
}

export async function startService(
  config: ServiceConfig,
): Promise<AsyncDisposable> {
  // ...
}

// service/my-service/index.ts
import { startService } from '@atproto/my-service'

// Control the service lifecycle with an AbortController, based on SIGINT and SIGTERM signals (or any other signals you want to handle).
const ac = new AbortController()
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  const abort = (reason: unknown) => ac.abort(reason)
  process.on(sig, abort)
  ac.signal.addEventListener('abort', () => process.off(sig, abort))
}

// Whenever we get an exit signal, we want to give the service a chance to clean up and exit gracefully. If it doesn't exit within 10 seconds, we force exit with an error code.
ac.signal.addEventListener('abort', () => {
  setTimeout(() => {
    console.error('Process failed to exit gracefully, forcing exit')
    process.exit(process.exitCode || 2)
  }, 10_000).unref()
})

async function main() {
  // setup and start service (e.g. HTTP server, database connections, etc.)
  await using service = await startService({
    // ...
  })

  // Let the service run until the signal is aborted (e.g. SIGINT or SIGTERM)
  if (!signal.aborted) await once(signal, 'abort')

  // The service's [Symbol.asyncDispose]() method will be called automatically by the `await using` statement, which will clean up resources and allow the process to exit naturally.
}

main(ac.signal).catch((err) => {
  ac.abort(err)
  console.error('Error running service:', err)
  process.exitCode = 1
})
```

Here is an example `events.ts` module that exposes utilities to trigger Meters and Logs:

```ts
// src/events.ts
import { type Meter, ValueType, metrics } from '@opentelemetry/api'
import { type Logger, SeverityNumber, logs } from '@opentelemetry/api-logs'
import { eventsLogger } from './logger.js'

const meter: Meter = metrics.getMeter('@atproto/my-service')
const logger: Logger = logs.getLogger('@atproto/my-service')

const userCreatedCounter = meter.createCounter<{
  // Use low cardinality attributes for metrics!
  plan: 'free' | 'premium'
}>('user.created', {
  description: 'Number of users created on this service',
  valueType: ValueType.INT,
})

export function userCreated(user: UserInfo) {
  // Counter: low-cardinality attributes only
  userCreatedCounter.add(1, { plan: user.plan })

  // OTEL log record (selective emission only): full detail, trace-correlated
  // when inside a span
  logger.emit({
    eventName: 'user.created',
    severityNumber: SeverityNumber.INFO,
    attributes: { userId: user.id, userPlan: user.plan },
  })

  // pino: same event on stdout, even when OTEL export is disabled
  eventsLogger.info({
    eventName: 'user.created',
    userId: user.id,
    userPlan: user.plan,
  })
}
```

Here is how the `events.ts` module can be used:

```ts
import * as events from './events.js'

export class UserService {
  // ...

  async createUser(userInfo: UserInfo) {
    const user = await this.db.createUser(userInfo)

    // Emit telemetry event!
    events.userCreated(user)

    return user
  }
}
```

## Resource disposal

- A class owning a resource (server, subscription, DB handle) implements `async [Symbol.asyncDispose]()`, typically delegating to its existing `destroy()` / `close()`. Consumers then use `await using` instead of `try` / `finally`.

## Scope of a change

- Don't refactor unrelated code. Keep the diff to what the change actually requires.
- **When removing code, don't leave references to it.** Comments, docs, and names must describe the current state only — no "previously…", "used to…", or mentions of a deleted symbol.
