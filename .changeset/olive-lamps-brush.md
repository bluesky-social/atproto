---
'@atproto/ozone': patch
---

Fix createReport reporter validation to only consult the reporter's account-level moderation status. Previously a takedown or pending appeal on any of the reporter's records (posts, lists, etc.) could incorrectly block them from submitting reports or appeals.
