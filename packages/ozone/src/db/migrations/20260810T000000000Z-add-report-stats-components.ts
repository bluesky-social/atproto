import { type Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('report_activity')
    .addColumn('actionEventIds', 'jsonb')
    .addColumn('queueId', 'integer')
    .addColumn('assignmentId', 'integer')
    .addColumn('moderatorDid', 'text')
    .addColumn('assignmentStartAt', 'varchar')
    .execute()

  await db.schema
    .createIndex('idx_report_activity_type_created')
    .on('report_activity')
    .columns(['activityType', 'createdAt', 'id'])
    .execute()

  await db.schema
    .alterTable('report_stat')
    .addColumn('closedCount', 'integer')
    .addColumn('acknowledgedCount', 'integer')
    .addColumn('labelActionCount', 'integer')
    .addColumn('tagActionCount', 'integer')
    .addColumn('takedownActionCount', 'integer')
    .addColumn('ahtDurationSec', 'bigint')
    .addColumn('ahtSampleCount', 'integer')
    .addColumn('moderatorHandlingDurationSec', 'bigint')
    .addColumn('moderatorHandlingSampleCount', 'integer')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_report_activity_type_created').execute()

  await db.schema
    .alterTable('report_activity')
    .dropColumn('actionEventIds')
    .dropColumn('queueId')
    .dropColumn('assignmentId')
    .dropColumn('moderatorDid')
    .dropColumn('assignmentStartAt')
    .execute()

  await db.schema
    .alterTable('report_stat')
    .dropColumn('closedCount')
    .dropColumn('acknowledgedCount')
    .dropColumn('labelActionCount')
    .dropColumn('tagActionCount')
    .dropColumn('takedownActionCount')
    .dropColumn('ahtDurationSec')
    .dropColumn('ahtSampleCount')
    .dropColumn('moderatorHandlingDurationSec')
    .dropColumn('moderatorHandlingSampleCount')
    .execute()
}
