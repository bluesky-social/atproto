import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('mute')
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('mutedByDid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('mute_pkey', ['mutedByDid', 'did'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('mute').execute()
}
