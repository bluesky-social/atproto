import { Kysely } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<any>, dialect: Dialect): Promise<void> {
  if (dialect === 'sqlite') {
    return
  }
  await db.schema.alterTable('repo_seq').renameColumn('seq', 'id').execute()
  await db.schema.alterTable('repo_seq').renameTo('repo_event').execute()
  await db.schema
    .createView('repo_seq')
    .as(
      db
        .selectFrom('repo_event')
        .select([
          'id as seq',
          'did',
          'eventType',
          'event',
          'invalidated',
          'sequencedAt',
        ]),
    )
    .execute()
}

export async function down(
  db: Kysely<unknown>,
  dialect: Dialect,
): Promise<void> {
  if (dialect === 'sqlite') {
    return
  }
  await db.schema.dropView('repo_seq').execute()
  await db.schema.alterTable('repo_event').renameColumn('id', 'seq').execute()
  await db.schema.alterTable('repo_event').renameTo('repo_seq').execute()
}
