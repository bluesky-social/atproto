import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('phone_verification')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('phoneNumber', 'varchar', (col) => col.notNull())
    .execute()
  await db.schema
    .createIndex('phone_verification_number_idx')
    .on('phone_verification')
    .column('phoneNumber')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('phone_verification').execute()
}
