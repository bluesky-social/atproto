---
'@atproto/pds': patch
---

Add `PDS_TRUSTED_PROXIES`, the proxies trusted to report the client IP through `X-Forwarded-For`: a comma-separated list of IP addresses, CIDR ranges, or the `loopback`, `linklocal` and `uniquelocal` presets. When unset, the PDS keeps trusting those three presets, plus `PDS_RATE_LIMIT_BYPASS_IPS` when rate limits are enabled.
