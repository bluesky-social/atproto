---
'@atproto/ozone': patch
'@atproto/api': minor
'@atproto/bsky': patch
'@atproto/pds': patch
---

Supply missing strike expiry from severity settings, with an optional
OZONE_STRIKE_EXPIRY_DAYS override and bounded reconciliation of adopted history.
Retain signed strike adjustments and expose their saved expiry in event views.
