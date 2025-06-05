import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('operation')
    .renameColumn('collection', 'namespace')
    .execute()

  await db.schema.alterTable('operation').renameColumn('rkey', 'key').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('operation')
    .renameColumn('namespace', 'collection')
    .execute()

  await db.schema.alterTable('operation').renameColumn('key', 'rkey').execute()
}
