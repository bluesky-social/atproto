import { type Kysely, sql } from 'kysely'

// @TODO remove before beta, along with `kem-key-backfill.ts`
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('kem_key_backfill_lease')
    .addColumn('id', 'integer', (col) => col.primaryKey())
    .addColumn('owner', 'varchar', (col) => col.notNull())
    .addColumn('expiresAt', 'integer', (col) => col.notNull())
    .addColumn('completedAt', 'varchar')
    .execute()
  await sql`
    insert into kem_key_backfill_lease (id, owner, expiresAt) values (1, '', 0)
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('kem_key_backfill_lease').execute()
}
