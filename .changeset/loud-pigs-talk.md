---
'@atproto/bsky': patch
---

For a service JWT with `iss` `did:plc:x#atproto_labeler`, the `viewer` is set as `did:plc:x` instead of `did:plc:x#atproto_labeler`. Service JWTs with an `iss` service id other than `#atproto` and `#atproto_labeler` are rejected.
