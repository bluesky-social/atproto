---
"@atproto/api": patch
"@atproto/bsky": patch
"@atproto/ozone": patch
"@atproto/pds": patch
---

Add strict access flag to report queues. Non-admin users will only be able to access strict queues and their reports if they are assigned to them.

Allow filtering SafeLink rules by exact source in queryRules, combining with existing filters and pagination.
