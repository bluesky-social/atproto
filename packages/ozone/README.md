# @atproto/ozone: Bluesky Moderation Service

Backend service for moderating the Bluesky network.

[![NPM](https://img.shields.io/npm/v/@atproto/ozone)](https://www.npmjs.com/package/@atproto/ozone)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

## Wildcard label queries

Wildcard patterns in `com.atproto.label.queryLabels` are disabled by default, including `*` and requests mixing wildcard and exact patterns. They return HTTP 400 (`InvalidRequest`) with the message "Support for wildcard label queries is temporarily disabled" before accessing the database. Exact URI queries remain available.

Set `OZONE_LABEL_QUERY_WILDCARDS_ENABLED=true` and restart the API to restore wildcard support. Unset or `false` disables it.

## Moderation query cancellation

`queryEvents` and `queryStatuses` cancel their listing SQL when the HTTP client disconnects, using Kysely's `cancel query` abort strategy. Kysely uses a separate PostgreSQL connection for cancellation and holds the listing connection until SQL and cancellation finish. This adds no query deadline.

## Moderation inbox standing

Set `NEXT_PUBLIC_STRIKE_SUSPENSION_CONFIG` to the same value used by Ozone UI, for example `4:72,8:168,12:336,16:Infinity`. Each entry maps a strike count to suspension hours; `Infinity` represents a permanent suspension. The backend retains the full map and uses the second and third thresholds, sorted by strike count, for `warning` and `atRisk`. The first tier does not change standing. With no configuration, standing derives from the account's enforcement and restrictions; strike thresholds are disabled. Invalid entries fail configuration at startup.

## Moderation inbox start date

Set `OZONE_INBOX_START_AT` on both the API and daemon to an ISO 8601 timestamp with a timezone, for example `2026-10-15T00:00:00.000Z`. Configuration normalizes it to UTC milliseconds and rejects invalid values at startup. Unset exposes all history. A future date keeps history empty until eligible activity occurs; changing the value requires restarting the services.

Reports are visible only when their `createdAt` is at or after the date, even if an older report is later resolved or reopened. The same bound applies to report detail and resolution actions. Subjects require a public action created at or after the date; action counts, first-action dates, latest actions, detail history and report summaries exclude earlier history. Older appeal history is hidden, while eligibility still respects earlier appeals. Inbox appeals cannot target hidden actions or subjects. Moderator previews use the same cutoff.

Account standing and current enforcement remain live: active restrictions, strikes and labels can predate the inbox start. Preferences and seen watermarks do not expose history; they retain their existing behavior. The cutoff is not a read watermark, so an item created exactly at the start date is initially unread.

Notification producers skip activity before the date and skip transitions on reports or appeal subjects that would be hidden. Lists and unread counts independently enforce the date and target visibility, including existing stored notifications. API and daemon must use the same value. Source reports/actions continue to be recorded normally. Moving the date earlier can reveal more source history, but skipped notifications are not backfilled. Complete the writer rollout before the chosen start date to avoid a notification gap.

Report-first pagination requires the `reporterDid` backfill and the post-retirement catch-up sweep to finish before deploying this reader. Pre-create the reporter/time indexes and `idx_moderation_event_inbox_public_created` concurrently in production before the inbox migration. The latter indexes `(subjectDid, createdAt DESC, id DESC)` so subject history can seek the configured date.

## Strike expiry

For strike-bearing takedowns and emails without an explicit `strikeExpiresAt`,
Ozone uses the instance `tools.ozone.setting.severityLevels` setting. A positive
`expiryInDays` expires the strike that many 24-hour days after the event's
creation time. Zero or an omitted duration keeps the strike permanent. Warning
events with zero strikes do not get an expiry. Explicit timestamps are retained.

Policy-managed expiries follow subsequent edits to `expiryInDays`, including
existing strikes. The daemon checks for edits every minute and commits batches
of 50 account DIDs, with progress in `job_cursor` under `strike_expiry_policy`.
It refreshes event expiries and active account counts directly, including when
a shorter policy moves an expiry behind the normal expiry cursor. Removing a
severity retains its saved expiries. Lifetime net strike totals are unchanged.

Negative strike reversals reference the most recent takedown for that subject,
cannot exceed its remaining strikes, and inherit its expiry. Reversing an
already expired strike therefore does not create a negative active count.

Existing NULL expiries are not automatically adopted on deployment. Historical
repair must explicitly mark policy-managed strikes and link their reversals,
then reconcile account counts. All strike writers and repairs must acquire the
transaction advisory lock `pg_advisory_xact_lock(hashtextextended(did, 1))`
before reading or changing an account's strike history. Complete the API and
daemon rollout before repairing history. Expiry does not restore content or
reverse account enforcement.

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
