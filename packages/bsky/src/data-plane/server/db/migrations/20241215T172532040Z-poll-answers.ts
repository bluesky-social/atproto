import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('poll_answer')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('subjectCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addColumn('answer', 'int8', (col) => col.notNull())
    .addColumn('sortAt', 'varchar', (col) =>
      col
        .generatedAlwaysAs(sql`least("createdAt", "indexedAt")`)
        .stored()
        .notNull(),
    )
    // Aids in index uniqueness plus answer counting
    .addUniqueConstraint('poll_answer_unique_subject_answer', ['subject', 'answer', 'creator'])
    .execute()

  await db.schema
    .alterTable('post_agg')
    .addColumn('pollAnswerCount', 'bigint', (col) => col.notNull().defaultTo(0))
    .execute()

  await db.schema
    .alterTable('post_agg')
    .addColumn('pollAnswers', 'json', (col) => col.notNull().defaultTo(sql`${JSON.stringify([])}`))
    .execute()

}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('poll_answer').execute()

  await db.schema
    .alterTable('post_agg')
    .dropColumn('pollAnswerCount')
    .execute()

  await db.schema
    .alterTable('post_agg')
    .dropColumn('pollAnswers')
    .execute()
}
