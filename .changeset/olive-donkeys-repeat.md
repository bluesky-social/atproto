---
'@atproto/oauth-provider-ui': minor
---

Rebuild the OAuth provider UI on shadcn/ui (Base UI, `base-nova`). Same flows,
steps and copy; the UX patterns are recomposed for shadcn. Forms use the
browser's native constraint validation on Base UI (no form library), icons move
to Lucide, and toasts to the Base UI toast. Branding colours configured on the
provider apply at runtime, with a neutral fallback when none are set.
