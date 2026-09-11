---
'@atproto/ozone': patch
---

Drop ozone's own `SafeDidResolver` in favor of `@atproto/identity`'s safe
resolution, still relaxed by `OZONE_DEV_MODE`.
