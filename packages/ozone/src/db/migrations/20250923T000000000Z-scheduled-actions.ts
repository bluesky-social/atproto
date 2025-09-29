import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('scheduled_action')
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('action', 'varchar', (col) => col.notNull())
    .addColumn('eventData', 'jsonb')
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('executeAt', 'timestamptz')
    .addColumn('executeAfter', 'timestamptz')
    .addColumn('executeUntil', 'timestamptz')
    .addColumn('randomizeExecution', 'boolean', (col) => col.defaultTo(false))
    .addColumn('createdBy', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) => col.defaultTo('now()'))
    .addColumn('updatedAt', 'timestamptz', (col) => col.defaultTo('now()'))
    .addColumn('status', 'varchar', (col) => col.defaultTo('pending'))
    .addColumn('lastExecutedAt', 'timestamptz')
    .addColumn('lastFailureReason', 'text')
    .addColumn('executionEventId', 'bigint')
    .execute()

  // Unique constraint to prevent multiple pending actions for the same subject
  await db.schema
    .createIndex('scheduled_action_unique_pending_subject')
    .unique()
    .on('scheduled_action')
    .columns(['did', 'action', 'status'])
    .execute()

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

  // for querying actions by status
  await db.schema
    .createIndex('scheduled_action_status_idx')
    .on('scheduled_action')
    .column('status')
    .execute()

  // for querying actions by creation time for pagination
  await db.schema
    .createIndex('scheduled_action_created_at_idx')
    .on('scheduled_action')
    .column('createdAt')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('scheduled_action').execute()
}
