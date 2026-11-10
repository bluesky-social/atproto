---
"@atproto/xrpc-server": patch
"@atproto/pds": patch
---

Add `PDS_DISABLE_IP_RATE_LIMITS`, for a PDS behind a proxy that enforces per-IP rate limits. When set with `PDS_RATE_LIMITS_ENABLED`, the PDS drops its global per-IP limit and the route limits keyed only on the client IP, and keeps its per-account limits. The xrpc-server `rateLimits` option gains `skipDefaultKeyedRouteLimits`, which skips route-specific limits that don't define their own `calcKey`.
