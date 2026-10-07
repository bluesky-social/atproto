# Ozone moderation inbox

- Read previews share `inboxViewerDid`; writes always use the authenticated DID.
- Viewer responses never expose moderator note text.
- Inbox appeal state and filters use the latest appeal report's status, as the submission guard does; subject reviewState and appealed flags are not synchronized by report activities. Unread includes appeal report updates, independently of the requested sort field. Apply filters before pagination.
- Read `NEXT_PUBLIC_STRIKE_SUSPENSION_CONFIG` through configuration. The second and third sorted strike thresholds determine warning and atRisk; retain the full hours map, including Infinity.
- Use explicit predicates for partial indexes on heavy tables. Report pagination seeks report.reporterDid/time indexes, validates source ownership before LIMIT by lateral primary-key lookup, and materializes only the page before hydration. Reporter backfill/catch-up is a deployment prerequisite.
- OZONE_INBOX_START_AT bounds history by inclusive creation time before pagination/aggregation, including details and notification targets. Keep live standing/enforcement and historical appeal eligibility authoritative; only display post-cutoff appeal history.
- Migrations that use report.reporterDid must run after _20261002T000000000Z. Pre-create large indexes concurrently in production and verify they are valid and ready before running transactional migrations.
