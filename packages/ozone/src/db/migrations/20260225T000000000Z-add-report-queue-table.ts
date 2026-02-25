import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Report queue configuration table
  await db.schema
    .createTable('report_queue')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'varchar', (col) => col.notNull().unique())

    // Queue filters (determine assignment)
    .addColumn('subjectTypes', 'jsonb', (col) => col.notNull()) // Array: ['account'] or ['record'] or both
    .addColumn('collection', 'varchar') // Collection name (e.g., 'app.bsky.feed.post'), NULL for accounts
    .addColumn('reportTypes', 'jsonb', (col) => col.notNull()) // Array: report reason types

    // Metadata
    .addColumn('createdBy', 'varchar', (col) => col.notNull()) // DID of mod who created queue
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('updatedAt', 'varchar', (col) => col.notNull())
    .addColumn('enabled', 'boolean', (col) => col.notNull().defaultTo(true))
    .execute()

  // Composite index covers all list queries: filter by enabled, sort by createdAt/id.
  // Leading enabled column also satisfies standalone enabled-only filters,
  // making a separate idx_queue_enabled redundant.
  await db.schema
    .createIndex('idx_queue_created_at')
    .on('report_queue')
    .columns(['enabled', 'createdAt', 'id'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_queue_created_at').execute()
  await db.schema.dropTable('report_queue').execute()
}
