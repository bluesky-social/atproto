import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<Schema>): Promise<void> {
  await db.schema
    .createTable('backlink')
    .addColumn('uri', 'varchar', (col) => col.notNull())
    .addColumn('path', 'varchar', (col) => col.notNull())
    .addColumn('linkToUri', 'varchar')
    .addColumn('linkToDid', 'varchar')
    .addPrimaryKeyConstraint('backlinks_pkey', ['uri', 'path'])
    .addCheckConstraint(
      'backlink_link_to_chk',
      // Exactly one of linkToUri or linkToDid should be set
      sql`("linkToUri" is null and "linkToDid" is not null) or ("linkToUri" is not null and "linkToDid" is null)`,
    )
    .execute()

  // Seed backlinks

  // Existing likes and their dupes
  await db
    .insertInto('backlink')
    .columns(['uri', 'linkToUri', 'path'])
    .expression((exp) =>
      exp
        .selectFrom('like')
        .select(['like.uri', 'like.subject', sql`${'subject.uri'}`.as('path')]),
    )
    .execute()
  await db
    .insertInto('backlink')
    .columns(['uri', 'linkToUri', 'path'])
    .expression((exp) =>
      exp
        .selectFrom('duplicate_record')
        .innerJoin('like', 'like.uri', 'duplicate_record.duplicateOf')
        .select([
          'duplicate_record.uri',
          'like.subject',
          sql`${'subject.uri'}`.as('path'),
        ]),
    )
    .execute()

  // Existing reposts and their dupes
  await db
    .insertInto('backlink')
    .columns(['uri', 'linkToUri', 'path'])
    .expression((exp) =>
      exp
        .selectFrom('repost')
        .select([
          'repost.uri',
          'repost.subject',
          sql`${'subject.uri'}`.as('path'),
        ]),
    )
    .execute()
  await db
    .insertInto('backlink')
    .columns(['uri', 'linkToUri', 'path'])
    .expression((exp) =>
      exp
        .selectFrom('duplicate_record')
        .innerJoin('repost', 'repost.uri', 'duplicate_record.duplicateOf')
        .select([
          'duplicate_record.uri',
          'repost.subject',
          sql`${'subject.uri'}`.as('path'),
        ]),
    )
    .execute()

  // Existing follows and their dupes
  await db
    .insertInto('backlink')
    .columns(['uri', 'linkToDid', 'path'])
    .expression((exp) =>
      exp
        .selectFrom('follow')
        .select([
          'follow.uri',
          'follow.subjectDid',
          sql`${'subject'}`.as('path'),
        ]),
    )
    .execute()
  await db
    .insertInto('backlink')
    .columns(['uri', 'linkToDid', 'path'])
    .expression((exp) =>
      exp
        .selectFrom('duplicate_record')
        .innerJoin('follow', 'follow.uri', 'duplicate_record.duplicateOf')
        .select([
          'duplicate_record.uri',
          'follow.subjectDid',
          sql`${'subject'}`.as('path'),
        ]),
    )
    .execute()

  await db.schema
    .createIndex('backlink_path_to_uri_idx')
    .on('backlink')
    .columns(['path', 'linkToUri'])
    .execute()
  await db.schema
    .createIndex('backlink_path_to_did_idx')
    .on('backlink')
    .columns(['path', 'linkToDid'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('backlink').execute()
}

type Schema = {
  backlink: Backlink
  like: Like
  follow: Follow
  repost: Repost
  duplicate_record: DuplicateRecord
}

interface Backlink {
  uri: string
  path: string
  linkToUri: string | null
  linkToDid: string | null
}

interface Like {
  uri: string
  subject: string
}

interface Follow {
  uri: string
  subjectDid: string
}

interface Repost {
  uri: string
  subject: string
}

interface DuplicateRecord {
  uri: string
  duplicateOf: string
}
