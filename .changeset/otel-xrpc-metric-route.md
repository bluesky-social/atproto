---
'@atproto-labs/opentelemetry-node': minor
---

Add an `xrpcMethods` option to `setup()` (and `getDefaultAtprotoInstrumentations()`) that puts the XRPC method on the `http.route` attribute of the HTTP server duration metric. Until now the XRPC-aware route was only applied to spans: metrics got whatever route the Express instrumentation last saw, which for catchall handlers is `/` or nothing at all. Methods not in the list are grouped under `/xrpc/{unknown}` to keep the attribute low-cardinality.

Also fix XRPC span naming and the `xrpc.method` / `xrpc.proxied` / `xrpc.proxy` span attributes on Express servers: Express gives incoming requests a `path` getter, which made them look like outgoing requests to the span hook, so it threw (silently) and never applied.
