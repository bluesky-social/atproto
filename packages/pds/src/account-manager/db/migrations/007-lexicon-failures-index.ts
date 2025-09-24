import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('lexicon_failures_idx')
    .on('lexicon')
    // https://github.com/kysely-org/kysely/issues/302
    .expression(sql`"updatedAt" DESC) WHERE ("lexicon" is NULL`)
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('lexicon_failures_idx').execute()
}
