---
'@atproto/oauth-provider': minor
'@atproto/oauth-provider-ui': patch
'@atproto/pds': patch
---

Add an optional per-scheme background image to the authorization screens via `branding.background`. The provider paints the configured light and dark image behind the auth card (`cover` / `center` over the neutral base), chosen by `prefers-color-scheme`. On the PDS, configure it with `PDS_BACKGROUND_LIGHT_URL` and `PDS_BACKGROUND_DARK_URL`.
