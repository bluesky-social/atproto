import { Kysely } from 'kysely'

export async function up(db: Kysely<Schema>): Promise<void> {
  // Nix downvotes from index
  const downvotesQb = db.selectFrom('vote').where('direction', '=', 'down')
  await db
    .deleteFrom('duplicate_record')
    .where('duplicateOf', 'in', downvotesQb.select('vote.uri'))
    .execute()
  await db.deleteFrom('vote').where('direction', '=', 'down').execute()
  // Drop vote indexes, direction column, and rename table
  await db.schema.dropIndex('vote_subject_direction_idx').execute()
  await db.schema.dropIndex('vote_unique_subject').execute()
  await db.schema.alterTable('vote').dropColumn('direction').execute()
  await db.schema.alterTable('vote').renameTo('like').execute()
  // Recreate like indexes
  await db.schema
    .createIndex('like_unique_subject')
    .on('like')
    .columns(['creator', 'subject'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('like_unique_subject').execute()
  await db.schema.alterTable('like').renameTo('vote').execute()
  await db.schema
    .alterTable('vote')
    .addColumn('direction', 'varchar', (col) => col.notNull().defaultTo('up'))
    .execute()
  await db.schema
    .createIndex('vote_unique_subject')
    .on('vote')
    .columns(['creator', 'subject'])
    .execute()
  await db.schema
    .createIndex('vote_subject_direction_idx')
    .on('vote')
    .columns(['subject', 'direction'])
    .execute()
}

type Schema = {
  vote: Vote
  duplicate_record: DuplicateRecord
}

type Vote = {
  uri: string
  direction: 'up' | 'down'
}

type DuplicateRecord = {
  uri: string
  duplicateOf: string
}
