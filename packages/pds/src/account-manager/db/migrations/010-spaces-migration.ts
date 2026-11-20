import { type Kysely, sql } from 'kysely'

// Now, formatted as JS's toISOString(), so that datetimes compare as strings
const nowDatetime = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('spaces_migration')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('storeMigratedAt', 'varchar')
    .addColumn('kemPublishedAt', 'varchar')
    .addColumn('unpublishableReason', 'varchar')
    .addColumn('attempts', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('lastError', 'varchar')
    // Null while the account waits on an event, e.g. activation
    .addColumn('nextAttemptAt', 'varchar', (col) => col.defaultTo(nowDatetime))
    .addColumn('priority', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('leaseOwner', 'varchar')
    .addColumn('leaseExpiresAt', 'varchar')
    .addColumn('sweepLeaseOwner', 'varchar')
    .addColumn('sweepLeaseExpiresAt', 'varchar')
    .addColumn('sweepAttempts', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('sweepLastError', 'varchar')
    .addColumn('sweepNextAttemptAt', 'varchar', (col) =>
      col.notNull().defaultTo(nowDatetime),
    )
    .execute()
  // Partial, so that finished and waiting rows (nearly all of them,
  // eventually) aren't in it. Claims go one priority at a time, so that
  // `nextAttemptAt` bounds the scan and rows backing off aren't visited.
  // The `is not null` term is implied by claims' `nextAttemptAt <= ?`.
  await db.schema
    .createIndex('spaces_migration_due_idx')
    .on('spaces_migration')
    .columns(['priority', 'nextAttemptAt'])
    .where(sql.ref('kemPublishedAt'), 'is', null)
    .where(sql.ref('unpublishableReason'), 'is', null)
    .where(sql.ref('nextAttemptAt'), 'is not', null)
    .execute()
  await db.schema
    .createIndex('spaces_migration_unswept_idx')
    .on('spaces_migration')
    .column('sweepNextAttemptAt')
    .where(sql.ref('storeMigratedAt'), 'is', null)
    .execute()

  await db.schema
    .createTable('spaces_migration_state')
    .addColumn('id', 'integer', (col) => col.primaryKey())
    .addColumn('publishStartAt', 'varchar', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('spaces_migration_state').execute()
  await db.schema.dropTable('spaces_migration').execute()
}
