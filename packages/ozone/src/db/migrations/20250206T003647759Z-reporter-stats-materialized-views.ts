import { Kysely, sql } from 'kysely'
import { DatabaseSchemaType } from '../schema'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
CREATE MATERIALIZED VIEW reporter_stats AS
SELECT
    reports."createdBy" AS did,
    
    -- Count total number of reports for accounts (including duplicates)
    COUNT(*) FILTER (
        WHERE reports."action" = 'tools.ozone.moderation.defs#modEventReport'
        AND reports."subjectUri" IS NULL
    ) AS "accountReportCount",

    -- Count total number of reports for records (including duplicates)
    COUNT(*) FILTER (
        WHERE reports."action" = 'tools.ozone.moderation.defs#modEventReport'
        AND reports."subjectUri" IS NOT NULL
    ) AS "recordReportCount",

    -- Count unique accounts reported
    COUNT(DISTINCT reports."subjectDid") FILTER (
        WHERE reports."subjectUri" IS NULL
    ) AS "reportedAccountCount",

    -- Count unique records reported
    COUNT(DISTINCT reports."subjectUri") FILTER (
        WHERE reports."subjectUri" IS NOT NULL
    ) AS "reportedRecordCount",

    -- Count unique accounts taken down by moderators
    COUNT(DISTINCT actions."subjectDid") FILTER (
        WHERE actions."action" = 'tools.ozone.moderation.defs#modEventTakedown'
        AND reports."subjectUri" IS NULL
    ) AS "takendownAccountCount",

    -- Count unique records taken down by moderators
    COUNT(DISTINCT actions."subjectUri") FILTER (
        WHERE actions."action" = 'tools.ozone.moderation.defs#modEventTakedown'
        AND reports."subjectUri" IS NOT NULL
    ) AS "takendownRecordCount",

    -- Count unique accounts labeled by moderators
    COUNT(DISTINCT actions."subjectDid") FILTER (
        WHERE actions."action" = 'tools.ozone.moderation.defs#modEventLabel'
        AND reports."subjectUri" IS NULL
    ) AS "labeledAccountCount",

    -- Count unique records labeled by moderators
    COUNT(DISTINCT actions."subjectUri") FILTER (
        WHERE actions."action" = 'tools.ozone.moderation.defs#modEventLabel'
        AND reports."subjectUri" IS NOT NULL
    ) AS "labeledRecordCount"

FROM moderation_event AS reports
LEFT JOIN moderation_event AS actions ON
    reports."subjectDid" = actions."subjectDid"
    AND (
        (reports."subjectUri" IS NOT NULL AND reports."subjectUri" = actions."subjectUri")
        OR (reports."subjectUri" IS NULL AND actions."subjectUri" IS NULL)
    )
    AND actions."action" IN (
        'tools.ozone.moderation.defs#modEventTakedown',
        'tools.ozone.moderation.defs#modEventLabel'
    )

WHERE reports."action" = 'tools.ozone.moderation.defs#modEventReport'

GROUP BY reports."createdBy";
  `.execute(db)
  await db.schema
    .createIndex('reporter_stats_did_idx')
    .unique()
    .on('reporter_stats')
    .column('did')
    .execute()
}

export async function down(db: Kysely<DatabaseSchemaType>): Promise<void> {
  db.schema.dropView('reporter_stats').materialized().execute()
}
