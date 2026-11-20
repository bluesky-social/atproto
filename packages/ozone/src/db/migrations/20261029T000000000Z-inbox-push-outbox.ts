import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('inbox_push_outbox')
    .addColumn('notificationId', 'integer', (col) =>
      col.primaryKey().references('inbox_notification.id').onDelete('cascade'),
    )
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('state', 'varchar', (col) => col.notNull().defaultTo('pending'))
    .addColumn('leaseToken', 'varchar')
    .addColumn('leaseUntil', 'timestamptz')
    .addColumn('attempts', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('finishedAt', 'timestamptz')
    .execute()
  await sql`CREATE INDEX inbox_push_outbox_pending_idx
    ON inbox_push_outbox ("createdAt", "notificationId")
    WHERE state = 'pending'`.execute(db)
  await sql`CREATE INDEX inbox_push_outbox_finished_idx
    ON inbox_push_outbox ("finishedAt")
    WHERE "finishedAt" IS NOT NULL`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('inbox_push_outbox').execute()
}
