import { DynamicModule, Kysely, sql } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('feed_item')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('type', 'varchar', (col) => col.notNull())
    .addColumn('postUri', 'varchar', (col) => col.notNull())
    .addColumn('originatorDid', 'varchar', (col) => col.notNull())
    .addColumn('sortAt', 'varchar', (col) => col.notNull())
    .execute()
  await db.schema
    .createIndex('feed_item_originator_idx')
    .on('feed_item')
    .column('originatorDid')
    .execute()
  await db.schema
    .createIndex('feed_item_cursor_idx')
    .on('feed_item')
    .columns(['sortAt', 'cid'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('feed_item').execute()
}

// This is intentionally not called here, but exists for documentation purposes.
// This query should be safe to be run any time to update the feed_item index.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getFeedItemMigrationSql(db: Kysely<Schema>, dialect: Dialect) {
  const { ref } = db.dynamic
  const migrationQb = db
    .insertInto('feed_item')
    .columns(['type', 'uri', 'cid', 'postUri', 'originatorDid', 'sortAt'])
    .expression((qb) => {
      return qb
        .selectFrom('post')
        .select([
          sql`'post'`.as('type'),
          'uri',
          'cid',
          'uri as postUri',
          'creator as originatorDid',
          min(dialect, ref('indexedAt'), ref('createdAt')).as('sortAt'),
        ])
        .unionAll(
          qb
            .selectFrom('repost')
            .innerJoin('post', 'post.uri', 'repost.subject')
            .select([
              sql`'repost'`.as('type'),
              'repost.uri as uri',
              'repost.cid as cid',
              'post.uri as postUri',
              'repost.creator as originatorDid',
              min(dialect, ref('repost.indexedAt'), ref('repost.createdAt')).as(
                'sortAt',
              ),
            ]),
        )
    })
    .onConflict((oc) => oc.doNothing())
  return migrationQb.compile().sql
}

type Schema = {
  feed_item: FeedItem
  post: Post
  repost: Repost
}

interface FeedItem {
  uri: string
  cid: string
  type: 'post' | 'repost'
  postUri: string
  postAuthorDid: string
  originatorDid: string
  sortAt: string
}

interface Post {
  uri: string
  cid: string
  creator: string
  text: string
  replyRoot: string | null
  replyRootCid: string | null
  replyParent: string | null
  replyParentCid: string | null
  createdAt: string
  indexedAt: string
}

interface Repost {
  uri: string
  cid: string
  creator: string
  subject: string
  subjectCid: string
  createdAt: string
  indexedAt: string
}

function min(dialect: Dialect, refA: DbRef, refB: DbRef) {
  if (dialect === 'pg') {
    return sql<string>`least(${refA}, ${refB})`
  } else {
    return sql<string>`min(${refA}, ${refB})`
  }
}

type DbRef = ReturnType<DynamicModule['ref']>
