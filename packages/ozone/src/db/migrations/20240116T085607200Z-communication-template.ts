import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('communication_template')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('contentMarkdown', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar')
    .addColumn('disabled', 'boolean', (col) => col.defaultTo(false).notNull())
    .addColumn('createdAt', 'timestamptz')
    .addColumn('updatedAt', 'timestamptz')
    .addColumn('lastUpdatedBy', 'varchar', (col) => col.notNull())
    .addUniqueConstraint('communication_template_unique_name', [
      'name',
      'disabled',
    ])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('communication_template')
}
