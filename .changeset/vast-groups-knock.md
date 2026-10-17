---
"@atproto/bsky": patch
"@atproto/ozone": patch
"@atproto/pds": patch
---

Add a `social.grain.photo` compatibility override that no longer requires `alt`, so the AppView renders Grain gallery photos that omit it. Ozone resolves the override; the PDS keeps validating writes against the published lexicon.
