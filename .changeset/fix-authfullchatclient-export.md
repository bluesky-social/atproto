---
"@atproto/bsky": patch
"@atproto/ozone": patch
"@atproto/pds": patch
---

Fix the `chat.bsky.authFullChatClient` permission set: it granted the non-existent `chat.bsky.convo.exportAccountData` RPC method instead of `chat.bsky.actor.exportAccountData`.
