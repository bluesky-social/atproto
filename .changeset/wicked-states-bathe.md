---
'@atproto/api': patch
'@atproto/bsky': patch
'@atproto/ozone': patch
---

Populate external embed `data` in feed responses with article, publication, gallery, and livestream modality views, including engagement counts and profile previews. Preserve legacy cards, exact root record pins, and latest publication dependencies. Validate embedded URL associations independently of legacy card and modality view rendering. Enforce configured safe domains for non-Standard.site embeds, with Streamplace URL-prefix and Grain host, gallery record-key, and DID-profile checks.
