---
'@atproto/bsky': patch
---

Keep persisted `getEmbedExternalView` associations slim: always return the canonical record, plus only an opted-in set of dependency collections (a Standard.site document's publication, a Grain gallery's items and photos). Recommendation, subscription and favorite records still back rendered previews but are no longer returned for persistence.
