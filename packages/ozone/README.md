# @atproto/ozone: Bluesky Moderation Service

Backend service for moderating the Bluesky network.

[![NPM](https://img.shields.io/npm/v/@atproto/ozone)](https://www.npmjs.com/package/@atproto/ozone)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

## Moderation inbox standing

Set `NEXT_PUBLIC_STRIKE_SUSPENSION_CONFIG` to the same value used by Ozone UI, for example `4:72,8:168,12:336,16:Infinity`. Each entry maps a strike count to suspension hours; `Infinity` represents a permanent suspension. The backend retains the full map and uses the second and third thresholds, sorted by strike count, for `warning` and `atRisk`. The first tier does not change standing. With no configuration, standing derives from the account's enforcement and restrictions; strike thresholds are disabled. Invalid entries fail configuration at startup.

## Moderation inbox start date

Set `OZONE_INBOX_START_AT` on both the API and daemon to an ISO 8601 timestamp with a timezone, for example `2026-10-15T00:00:00.000Z`. Configuration normalizes it to UTC milliseconds and rejects invalid values at startup. Unset exposes all history. A future date keeps history empty until eligible activity occurs; changing the value requires restarting the services.

Reports are visible only when their `createdAt` is at or after the date, even if an older report is later resolved or reopened. The same bound applies to report detail and resolution actions. Subjects require a public action created at or after the date; action counts, first-action dates, latest actions, detail history and report summaries exclude earlier history. Older appeal history is hidden, while eligibility still respects earlier appeals. Inbox appeals cannot target hidden actions or subjects. Moderator previews use the same cutoff.

Account standing and current enforcement remain live: active restrictions, strikes and labels can predate the inbox start. Preferences and seen watermarks do not expose history; they retain their existing behavior. Notifications and unread counts in the stacked notification implementation follow the same history and target visibility rules.

Report-first pagination requires the `reporterDid` backfill and the post-retirement catch-up sweep to finish before deploying this reader. Pre-create the reporter/time indexes and `idx_moderation_event_inbox_public_created` concurrently in production before the inbox migration. The latter indexes `(subjectDid, createdAt DESC, id DESC)` so subject history can seek the configured date.

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
