---
'@atproto/bsky': patch
---

Feed generator skeleton requests now use the same outbound request policy as blob requests: endpoints resolved from a feed generator's DID document are fetched over HTTPS only, to public addresses only, re-checked on each redirect hop. Endpoints configured directly (iris, iris staging and the trending feed) are unchanged.
