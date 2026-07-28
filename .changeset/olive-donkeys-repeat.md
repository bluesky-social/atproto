---
'@atproto/oauth-provider-ui': minor
---

Rebuild the OAuth provider UI on shadcn/ui (Base UI, `base-nova`). Same flows,
steps and copy; the UX patterns are recomposed for shadcn and the colour theme
is neutral for now. Forms move to react-hook-form + zod, icons to Lucide, and
toasts to Sonner.

Also fixes several bugs found along the way: every `Separator` rendered at zero
size because the Base UI orientation attributes had no matching Tailwind
variants; `Select` triggers displayed the raw value instead of the item label
(the domain picker showed `0`, the locale picker `en`); `DialogDescription`
nested a `<p>` inside a `<p>`; and list bullets were missing on the About page
below the `md` breakpoint.
