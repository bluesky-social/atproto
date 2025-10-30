import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('moderation_event')
    .addColumn('severityLevel', 'varchar')
    .execute()
  await db.schema
    .alterTable('moderation_event')
    .addColumn('strikeCount', 'integer')
    .execute()
  await db.schema
    .alterTable('moderation_event')
    .addColumn('strikeExpiresAt', 'varchar')
    .execute()

  await db.schema
    .createTable('account_strike')
    .addColumn('did', 'text', (col) => col.primaryKey())
    .addColumn('firstStrikeAt', 'varchar')
    .addColumn('lastStrikeAt', 'varchar')
    .addColumn('activeStrikeCount', 'integer', (col) =>
      col.notNull().defaultTo(0),
    )
    .addColumn('totalStrikeCount', 'integer', (col) =>
      col.notNull().defaultTo(0),
    )
    .execute()

  await db.schema
    .createTable('job_cursor')
    .addColumn('job', 'text', (col) => col.primaryKey())
    .addColumn('cursor', 'text')
    .addColumn('updatedAt', 'text', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute()

  // This supports fast look up for background job that aggregates strike data per subjectDid
  await db.schema
    .createIndex('moderation_event_subject_did_strike_count_idx')
    .on('moderation_event')
    .columns(['subjectDid', 'strikeCount'])
    .execute()

  // This supports fast lookup in the background job that needs to find strikes that have expired
  await sql`
    CREATE INDEX moderation_event_strike_expires_at_strike_count_idx
    ON moderation_event ("strikeExpiresAt", "strikeCount")
    WHERE "strikeExpiresAt" IS NOT NULL AND "strikeCount" IS NOT NULL
  `.execute(db)

  // for sorting and filtering by active strike count
  await db.schema
    .createIndex('account_strike_active_count_idx')
    .on('account_strike')
    .column('activeStrikeCount')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .dropIndex('moderation_event_subject_did_strike_count_idx')
    .execute()
  await db.schema
    .dropIndex('moderation_event_strike_expires_at_strike_count_idx')
    .execute()
  await db.schema.dropIndex('account_strike_active_count_idx').execute()

  await db.schema.dropTable('account_strike').execute()
  await db.schema.dropTable('job_cursor').execute()

  await db.schema
    .alterTable('moderation_event')
    .dropColumn('severityLevel')
    .execute()

  await db.schema
    .alterTable('moderation_event')
    .dropColumn('strikeCount')
    .execute()

  await db.schema
    .alterTable('moderation_event')
    .dropColumn('strikeExpiresAt')
    .execute()
}
