# @atproto-labs/opentelemetry-node

OpenTelemetry bootstrap for atproto Node.js services.

This package wires up the OpenTelemetry Node SDK from the conventional `OTEL_*`
environment variables, so a service only has to supply its identity and the list
of instrumentations it wants.

Telemetry is **opt-in via the exporter endpoint**: the SDK stays disabled until an
OTLP endpoint is configured (`OTEL_EXPORTER_OTLP_ENDPOINT` or a signal-specific
variant). `OTEL_SDK_DISABLED` remains a kill switch.

## Configuration

Everything beyond the service identity and instrumentation list is driven by the
conventional `OTEL_*` environment variables. See the OpenTelemetry docs for the
full set:

- [General SDK configuration](https://opentelemetry.io/docs/languages/sdk-configuration/general/)
- [OTLP exporter configuration](https://opentelemetry.io/docs/languages/sdk-configuration/otlp-exporter/)

## Usage

Load it before any instrumented module — typically through Node's `--import` flag:

```ts
import { setup } from '@atproto-labs/opentelemetry-node'
import { ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from '@atproto-labs/opentelemetry-node/conventions'
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis'
import pkg from './package.json' with { type: 'json' }

setup(() => ({
  name: pkg.name,
  version: pkg.version,
  // Optional: override or extend the default resource attributes.
  defaultResourceAttributes: { [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: 'staging' },
  // Service-specific instrumentations. The instrumentations common to atproto
  // services are always registered in addition to these.
  instrumentations: [new IORedisInstrumentation()],
}))
```

`setup()` takes a thunk so nothing is constructed when telemetry is disabled: the
options — and therefore the instrumentations — are only built once an OTLP endpoint
is configured.

The instrumentations common to atproto services (HTTP with XRPC-aware span naming,
Express, Undici, Pino with log correlation, and Node runtime metrics) are always
registered alongside the ones you supply. The
`@atproto-labs/opentelemetry-node/instrumentation` entrypoint exposes
`getDefaultAtprotoInstrumentations()` if you need that list directly.

The `@atproto-labs/opentelemetry-node/conventions` entrypoint re-exports
`@opentelemetry/semantic-conventions` plus the atproto XRPC attribute keys
(`ATTR_XRPC_METHOD`, `ATTR_XRPC_PROXIED`, `ATTR_XRPC_PROXY`).

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.

Bluesky Social PBC has committed to a software patent non-aggression pledge. For details see [the original announcement](https://bsky.social/about/blog/10-01-2025-patent-pledge).
