---
"@atproto/api": patch
"@atproto/bsky": patch
"@atproto/ozone": patch
---

Add optional `providerId` attribution to external article, publication, gallery, and livestream views. Detect providers server-side from known record types, Standard.site document content and publication theme type tags (including custom domains), and URL fallbacks. Attribution is best-effort and cosmetic, not verified provenance.
