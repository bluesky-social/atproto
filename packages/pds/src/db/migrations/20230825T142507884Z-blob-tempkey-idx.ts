import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('blob_tempkey_idx')
    .on('blob')
    .column('tempKey')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('blob_tempkey_idx').execute()
}
