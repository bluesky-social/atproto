---
'@atproto/ozone': patch
---

Fix moderation actions and report matching for chat messages. Message takedown
and reverse-takedown events are now rejected because they cannot be enforced;
apply those actions to the account instead.
