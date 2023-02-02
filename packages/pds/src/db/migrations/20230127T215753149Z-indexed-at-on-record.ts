import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  const now = new Date().toISOString()
  await db.schema
    .alterTable('record')
    .addColumn('indexedAt', 'varchar', (col) => col.notNull().defaultTo(now))
    .execute()

  const ref = db.dynamic.ref

  const indexedAtForRecordQb = db
    .selectFrom('ipld_block')
    .whereRef('ipld_block.cid', '=', ref('record.cid'))
    .select('indexedAt')

  await db
    .updateTable('record')
    .set({
      indexedAt: indexedAtForRecordQb,
    })
    .whereExists(indexedAtForRecordQb)
    .execute()

  await db.schema.alterTable('ipld_block').dropColumn('indexedAt').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  const now = new Date().toISOString()
  await db.schema
    .alterTable('ipld_block')
    .addColumn('indexedAt', 'varchar', (col) => col.notNull().defaultTo(now))
    .execute()
  await db.schema.alterTable('record').dropColumn('indexedAt').execute()
}
