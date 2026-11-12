import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // @NOTE Unset categories inherit push, preserving opt-outs without a backfill.
  await db.schema
    .alterTable('inbox_notification_preference')
    .addColumn('reports', 'boolean')
    .addColumn('account', 'boolean')
    .addColumn('labels', 'boolean')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // @NOTE The global preference cannot express mixed categories; preserve opt-outs.
  await sql`update inbox_notification_preference
    set push = coalesce(reports, push)
      and coalesce(account, push)
      and coalesce(labels, push)
    where reports is not null or account is not null or labels is not null`.execute(
    db,
  )
  await db.schema
    .alterTable('inbox_notification_preference')
    .dropColumn('reports')
    .dropColumn('account')
    .dropColumn('labels')
    .execute()
}
