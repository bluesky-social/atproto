---
'@atproto/ozone': patch
---

Drop ozone's own `SafeDidResolver` in favor of `@atproto/identity`'s
SSRF-protected resolution, still relaxed by `OZONE_DEV_MODE`.
