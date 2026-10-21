---
"@atproto/api": patch
"@atproto/bsky": patch
"@atproto/ozone": patch
"@atproto/pds": patch
---

Add strict access flag to report queues. Non-admin moderators will not be able to access the queues unless they are assigned to them.

Allow filtering SafeLink rules by exact source in queryRules, combining with existing filters and pagination.
