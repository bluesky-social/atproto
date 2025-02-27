import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('moderation_subject_status')
    .addColumn('priorityScore', 'integer', (col) =>
      col.notNull().defaultTo('0'),
    )
    .execute()
  await db.schema
    .createIndex('moderation_subject_status_priority_score_index')
    .on('moderation_subject_status')
    .column('priorityScore')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('moderation_subject_status')
    .dropColumn('priorityScore')
    .execute()
}
