import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // The DDL lock lasts until Kysely commits this migration transaction. Fail
  // quickly if a long-running transaction is already holding the report table.
  await sql`SET LOCAL lock_timeout = '5s'`.execute(db)
  await db.schema
    .alterTable('report')
    .addColumn('reporterDid', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('report').dropColumn('reporterDid').execute()
}
