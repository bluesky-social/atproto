import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  const ref = db.dynamic.ref
  await sql`CREATE INDEX moderation_subject_status_sort_idx ON ${ref('moderation_subject_status')} (${ref('lastReportedAt')} DESC NULLS LAST, ${ref('id')} DESC NULLS LAST);`.execute(
    db,
  )
  await sql`CREATE INDEX moderation_subject_status_unreviewed_sort_idx ON ${ref('moderation_subject_status')} (${ref('lastReportedAt')} DESC NULLS LAST, ${ref('id')} DESC NULLS LAST) WHERE ${ref('reviewState')} = 'tools.ozone.moderation.defs#reviewNone';`.execute(
    db,
  )
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('moderation_subject_status_sort_idx').execute()
  await db.schema
    .dropIndex('moderation_subject_status_unreviewed_sort_idx')
    .execute()
}
