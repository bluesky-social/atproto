---
'@atproto-labs/opentelemetry-node': patch
---

Drop the `@connectrpc/connect` dependency: `statusCodeToString()` now takes a plain `number` and resolves the status name through a hand-rolled map of the Connect `Code` enum values. Importing the library here would load it before it gets instrumented, breaking the instrumentation.
