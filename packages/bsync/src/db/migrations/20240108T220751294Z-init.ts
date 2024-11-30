import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('mute_op')
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('type', 'int2', (col) => col.notNull()) // integer enum: 0->add, 1->remove, 2->clear
    .addColumn('actorDid', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute()
  await db.schema
    .createTable('mute_item')
    .addColumn('actorDid', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('fromId', 'bigint', (col) => col.notNull())
    .addPrimaryKeyConstraint('mute_item_pkey', ['actorDid', 'subject'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('mute_item').execute()
  await db.schema.dropTable('mute_op').execute()
}
