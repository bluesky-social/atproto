---
'@atproto-labs/opentelemetry-node': minor
---

Drop the `@opentelemetry/auto-instrumentations-node` dependency. Resource detection now only uses `@opentelemetry/sdk-node`'s local detectors plus the `container` one, so the cloud provider detectors (`alibaba`, `aws`, `azure`, `gcp`) no longer probe metadata endpoints at startup, and `OTEL_NODE_RESOURCE_DETECTORS` ignores their names with a warning.
