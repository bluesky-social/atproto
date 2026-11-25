---
'@atproto/syntax': patch
---

`AtUri` accepts every character valid in a DID in a URI's authority, so it parses `did:web` URIs whose host contains an underscore instead of throwing.
