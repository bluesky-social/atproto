---
"@atproto/identity": patch
---

Bound the in-memory DID document cache by entry count and serialized UTF-8 size, evict least recently used documents, and skip retaining oversized documents.
