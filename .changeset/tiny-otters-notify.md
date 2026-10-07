---
"@atproto/ozone": minor
"@atproto/api": minor
---

Add moderation inbox notifications, preferences, unread counts, and independent per-section seen watermarks with normalized timestamps and read-only staff previews. Batch and isolate notification producers from moderation failures, reuse the UI strike suspension configuration for account standing, and keep moderator note text private. Include raw record values in report and actioned-subject details for record subjects.

Apply OZONE_INBOX_START_AT to notification producers, lists, unread counts, and target visibility, including report closures and daemon standing changes.
