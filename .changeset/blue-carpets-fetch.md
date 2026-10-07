---
"@atproto/ozone": minor
"@atproto/api": minor
"@atproto/pds": patch
---

Add viewer-facing moderation inbox reads for configurable account standing, report details, and cursor-paginated action history, with PDS proxy access and read-only moderator previews. Include appeal attribution in moderator event views, structured policy details in takedown actions, and pending, resolved, and unread actioned-subject filters based on appeal report state. Keep moderator notes private.

Page reports through reporter/time indexes with bounded hydration and source ownership validation. Batch subject hydration, reuse indexes for report summaries, and limit latest appeal lookups to one row in SQL. Add non-appeal reporter/time indexes, with the inbox migration ordered after the reporter DID column migration.

Add OZONE_INBOX_START_AT to limit report, action, and appeal history by creation time, with a public subject/action creation-time index. Cover structured policy names, links, and fallback URLs in mapper regression tests.
