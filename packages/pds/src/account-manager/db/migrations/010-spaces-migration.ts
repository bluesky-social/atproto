import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('spaces_migration')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('storeMigratedAt', 'varchar')
    .addColumn('kemPublishedAt', 'varchar')
    .addColumn('unpublishableReason', 'varchar')
    .addColumn('attempts', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('lastError', 'varchar')
    .addColumn('nextAttemptAt', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('priority', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('leaseOwner', 'varchar')
    .addColumn('leaseExpiresAt', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('sweepLeaseOwner', 'varchar')
    .addColumn('sweepLeaseExpiresAt', 'integer', (col) =>
      col.notNull().defaultTo(0),
    )
    .execute()
  // Partial, so that finished rows (nearly all of them, eventually) aren't
  // scanned when claiming due ones
  await db.schema
    .createIndex('spaces_migration_due_idx')
    .on('spaces_migration')
    .columns(['priority desc', 'nextAttemptAt'])
    .where(sql.ref('kemPublishedAt'), 'is', null)
    .where(sql.ref('unpublishableReason'), 'is', null)
    .execute()
  await db.schema
    .createIndex('spaces_migration_store_migrated_at_idx')
    .on('spaces_migration')
    .column('storeMigratedAt')
    .execute()

  await db.schema
    .createTable('spaces_migration_state')
    .addColumn('id', 'integer', (col) => col.primaryKey())
    .addColumn('publishStartAt', 'integer', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('spaces_migration_state').execute()
  await db.schema.dropTable('spaces_migration').execute()
}
