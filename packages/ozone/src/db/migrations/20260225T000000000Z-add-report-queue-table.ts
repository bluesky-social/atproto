import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Report queue configuration table
  await db.schema
    .createTable('report_queue')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'varchar', (col) => col.notNull()) // uniqueness enforced via partial index below

    // Queue filters (determine assignment)
    .addColumn('subjectTypes', 'jsonb', (col) => col.notNull()) // Array: ['account'] or ['record'] or both
    .addColumn('collection', 'varchar') // Collection name (e.g., 'app.bsky.feed.post'), NULL for accounts
    .addColumn('reportTypes', 'jsonb', (col) => col.notNull()) // Array: report reason types

    // Metadata
    .addColumn('createdBy', 'varchar', (col) => col.notNull()) // DID of mod who created queue
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('updatedAt', 'varchar', (col) => col.notNull())
    .addColumn('enabled', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('deletedAt', 'varchar') // NULL = active, timestamp = soft-deleted
    .execute()

  // Partial unique index on name — only enforces uniqueness for non-deleted queues,
  // so a soft-deleted queue's name can be reused by a new queue.
  await sql`CREATE UNIQUE INDEX idx_queue_name_unique ON report_queue (name) WHERE "deletedAt" IS NULL`.execute(
    db,
  )

  // Partial composite index covers all list queries on active queues: filter by enabled,
  // sort by createdAt/id. The WHERE clause keeps the index small (deleted rows excluded).
  await sql`CREATE INDEX idx_queue_active ON report_queue (enabled, "createdAt", id) WHERE "deletedAt" IS NULL`.execute(
    db,
  )
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_queue_name_unique').execute()
  await db.schema.dropIndex('idx_queue_active').execute()
  await db.schema.dropTable('report_queue').execute()
}
