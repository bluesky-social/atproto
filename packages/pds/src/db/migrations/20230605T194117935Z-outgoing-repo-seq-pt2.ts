import { Kysely } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<unknown>, dialect: Dialect): Promise<void> {
  if (dialect === 'sqlite') {
    return
  }
  console.log('BEFORE')
  await db.schema.dropView('repo_seq').execute()
  console.log('AFTER')
}

export async function down(db: Kysely<any>, dialect: Dialect): Promise<void> {
  if (dialect === 'sqlite') {
    return
  }
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
