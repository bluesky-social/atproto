import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('setting')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('key', 'text', (col) => col.notNull())
    .addColumn('did', 'text', (col) => col.notNull())
    .addColumn('value', 'jsonb', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn('updatedAt', 'timestamptz', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn('managerRole', 'text')
    .addColumn('scope', 'text', (col) => col.notNull())
    .addColumn('createdBy', 'text', (col) => col.notNull())
    .addColumn('lastUpdatedBy', 'text', (col) => col.notNull())
    .addUniqueConstraint('setting_did_scope_key_idx', ['did', 'scope', 'key'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('setting').execute()
}
