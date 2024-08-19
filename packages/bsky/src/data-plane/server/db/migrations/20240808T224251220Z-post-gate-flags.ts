import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('post')
    .addColumn('violatesEmbeddingRules', 'boolean')
    .execute()
  await db.schema
    .alterTable('post')
    .addColumn('hasThreadGate', 'boolean')
    .execute()
  await db.schema
    .alterTable('post')
    .addColumn('hasPostGate', 'boolean')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('post')
    .dropColumn('violatesEmbeddingRules')
    .execute()
  await db.schema.alterTable('post').dropColumn('hasThreadGate').execute()
  await db.schema.alterTable('post').dropColumn('hasPostGate').execute()
}
