# Ozone moderation inbox

- Read previews share `inboxViewerDid`; writes always use the authenticated DID.
- Viewer responses never expose moderator note text.
- Read `NEXT_PUBLIC_STRIKE_SUSPENSION_CONFIG` through configuration. The second and third sorted strike thresholds determine warning and atRisk; retain the full hours map, including Infinity.
- Use explicit predicates for existing partial indexes on heavy tables. Reporter pagination must start with that reporter's event IDs; verify the plan rather than relying on a WHERE clause to constrain join order.
- Migrations that use report.reporterDid must run after _20261002T000000000Z. Pre-create large indexes concurrently in production and verify they are valid and ready before running transactional migrations.
