import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`SET LOCAL lock_timeout = '5s'`.execute(db)
  await db.schema
    .dropView('account_record_events_stats')
    .materialized()
    .ifExists()
    .execute()
  await db.schema
    .dropView('record_events_stats')
    .materialized()
    .ifExists()
    .execute()
  await db.schema
    .dropView('account_events_stats')
    .materialized()
    .ifExists()
    .execute()
  await db.schema
    .dropView('account_record_status_stats')
    .materialized()
    .ifExists()
    .execute()
}

export async function down(): Promise<void> {
  throw new Error(
    'Restoring moderation stats views requires a manual rebuild before rollback',
  )
}
