import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('scheduled_action')
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('action', 'varchar', (col) => col.notNull())
    .addColumn('eventData', 'jsonb')
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('executeAt', 'varchar')
    .addColumn('executeAfter', 'varchar')
    .addColumn('executeUntil', 'varchar')
    .addColumn('randomizeExecution', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .addColumn('createdBy', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('updatedAt', 'varchar', (col) => col.notNull())
    .addColumn('status', 'varchar', (col) => col.notNull().defaultTo('pending'))
    .addColumn('lastExecutedAt', 'varchar')
    .addColumn('lastFailureReason', 'text')
    .addColumn('executionEventId', 'bigint')
    .execute()

  // Unique constraint to prevent multiple pending actions for the same subject
  await sql`
    CREATE UNIQUE INDEX scheduled_action_unique_pending_subject
    ON scheduled_action (did, action)
    WHERE status = 'pending'
  `.execute(db)

  // for task runner to query pending actions efficiently
  await db.schema
    .createIndex('scheduled_action_execute_time_idx')
    .on('scheduled_action')
    .columns(['executeAt', 'executeAfter', 'status'])
    .execute()

  // for querying actions by subject
  await db.schema
    .createIndex('scheduled_action_did_idx')
    .on('scheduled_action')
    .column('did')
    .execute()

  // we require status to be always passed when listing scheduled actions and use createdAt for pagination
  await db.schema
    .createIndex('scheduled_action_status_created_at_idx')
    .on('scheduled_action')
    .columns(['status', 'createdAt'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('scheduled_action').execute()
}
