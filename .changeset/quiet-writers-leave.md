---
"@atproto/pds": patch
"@atproto/api": patch
---

Add `com.atproto.space.removeWriter`, which lets a space's authority drop an account from the space's writer set, as listed by `com.atproto.space.listRepos`. The account is tracked again if it later writes while still authorized. The PDS authorizes it with `manage=update` for the space.

`com.atproto.simplespace.removeMember` now also removes the member from the writer set, as does `com.atproto.simplespace.putMember` when it revokes write access.
