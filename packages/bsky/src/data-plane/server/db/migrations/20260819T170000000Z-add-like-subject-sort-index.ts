import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE INDEX like_subject_sort_at_creator_idx
    ON "like" ("subject", "sortAt" DESC)
    INCLUDE ("creator")
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('like_subject_sort_at_creator_idx').execute()
}
