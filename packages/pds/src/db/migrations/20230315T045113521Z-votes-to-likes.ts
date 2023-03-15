import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<Schema>): Promise<void> {
  // Nix downvotes from index
  const downvotesQb = db.selectFrom('vote').where('direction', '=', 'down')
  await db
    .deleteFrom('duplicate_record')
    .where('duplicateOf', 'in', downvotesQb.select('vote.uri'))
    .execute()
  await db.schema
    .createTable('like')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('subjectCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    // Aids in index uniqueness plus post like counts
    .addUniqueConstraint('like_unique_subject', ['subject', 'creator'])
    .execute()
  await db
    .insertInto('like')
    .columns([
      'uri',
      'cid',
      'creator',
      'subject',
      'subjectCid',
      'createdAt',
      'indexedAt',
    ])
    .expression((exp) =>
      exp
        .selectFrom('vote')
        .where('direction', '=', 'up')
        .select([
          'uri',
          'cid',
          'creator',
          'subject',
          'subjectCid',
          'createdAt',
          'indexedAt',
        ]),
    )
    .execute()
  const missing = await db
    .selectFrom('vote')
    .select(sql<number>`count(*)`.as('count'))
    .where('direction', '=', 'up')
    .whereNotExists(
      db
        .selectFrom('like')
        .selectAll()
        .whereRef('uri', '=', db.dynamic.ref('vote.uri')),
    )
    .executeTakeFirstOrThrow()
  if (missing.count !== 0) {
    throw new Error(
      `Likes were not migrated properly from votes: ${missing.count} likes missing.`,
    )
  }
  await db.schema.dropTable('vote').execute()
}

export async function down(db: Kysely<Schema>): Promise<void> {
  await db.schema
    .createTable('vote')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('direction', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('subjectCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addUniqueConstraint('vote_unique_subject', ['creator', 'subject'])
    .execute()
  await db
    .insertInto('vote')
    .columns([
      'uri',
      'cid',
      'creator',
      'direction',
      'subject',
      'subjectCid',
      'createdAt',
      'indexedAt',
    ])
    .expression((exp) =>
      exp
        .selectFrom('like')
        .select([
          'uri',
          'cid',
          'creator',
          sql`${'up'}`.as('direction'),
          'subject',
          'subjectCid',
          'createdAt',
          'indexedAt',
        ]),
    )
    .execute()
  await db.schema.dropTable('like').execute()
  await db.schema
    .createIndex('vote_subject_direction_idx')
    .on('vote')
    .columns(['subject', 'direction'])
    .execute()
}

type Schema = {
  vote: Vote
  like: Like
  duplicate_record: DuplicateRecord
}

type Vote = {
  uri: string
  direction: 'up' | 'down'
  [k: string]: unknown
}

type Like = {
  uri: string
  [k: string]: unknown
}

type DuplicateRecord = {
  uri: string
  duplicateOf: string
}
