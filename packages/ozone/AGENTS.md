# Ozone moderation inbox

- Read previews share `inboxViewerDid`; writes always use the authenticated DID.
- Produce moderation notifications from the common `ModerationService.logEvent` path so daemon actions are covered. Keep source snapshots in the source transaction, and isolate optional queries/inserts with `runNotificationWork` savepoints; a caught SQL error alone leaves PostgreSQL's transaction aborted.
- Batch report notifications and skip non-transition activities before querying. Viewer responses never expose moderator note text.
- Read `NEXT_PUBLIC_STRIKE_SUSPENSION_CONFIG` through configuration. The second and third sorted strike thresholds determine warning and atRisk; retain the full hours map, including Infinity.
- Use explicit predicates for existing partial indexes on heavy tables. Reporter pagination must start with that reporter's event IDs; verify the plan rather than relying on a WHERE clause to constrain join order.
