---
'@atproto-labs/opentelemetry-node': patch
---

Make the `xrpcMethods` option truly opt-in. When omitted, the `http.route` attribute of the HTTP server metrics is left as set by the Express instrumentation, instead of reporting every XRPC request as `/xrpc/{unknown}`.
