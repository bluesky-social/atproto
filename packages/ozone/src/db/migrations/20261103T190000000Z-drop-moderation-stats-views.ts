import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`SET LOCAL lock_timeout = '5s'`.execute(db)
  const result = await sql<{
    schema: string
  }>`SELECT current_schema() AS schema`.execute(db)
  const schema = result.rows[0]?.schema
  if (!schema)
    throw new Error('No current schema for moderation stats migration')
  const dbSchema = db.schema.withSchema(schema)
  await dbSchema
    .dropView('account_record_events_stats')
    .materialized()
    .ifExists()
    .execute()
  await dbSchema
    .dropView('record_events_stats')
    .materialized()
    .ifExists()
    .execute()
  await dbSchema
    .dropView('account_events_stats')
    .materialized()
    .ifExists()
    .execute()
  await dbSchema
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
