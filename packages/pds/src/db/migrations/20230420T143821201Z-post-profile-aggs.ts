import { Generated, Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('post_agg')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('likeCount', 'bigint', (col) => col.notNull().defaultTo(0))
    .addColumn('replyCount', 'bigint', (col) => col.notNull().defaultTo(0))
    .addColumn('repostCount', 'bigint', (col) => col.notNull().defaultTo(0))
    .execute()
  await db.schema
    .createTable('profile_agg')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('followersCount', 'bigint', (col) => col.notNull().defaultTo(0))
    .addColumn('followsCount', 'bigint', (col) => col.notNull().defaultTo(0))
    .addColumn('postsCount', 'bigint', (col) => col.notNull().defaultTo(0))
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('profile_agg').execute()
  await db.schema.dropTable('post_agg').execute()
}

// This is intentionally not called here, but exists for documentation purposes.
// This query should be safe to be run any time to update the feed_item index.

// @NOTE these can only update records that do not have a "zero" count, so it's suitable for an initial
// run, but it's not suitable for a general refresh (which may need to update a count down to zero).

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getAggMigrationSql(db: Kysely<Schema>) {
  const { ref } = db.dynamic
  const excluded = (col: string) => ref(`excluded.${col}`)

  const likeCountQb = db
    .insertInto('post_agg')
    .columns(['uri', 'likeCount'])
    .expression((exp) =>
      exp
        .selectFrom('like')
        .groupBy('like.subject')
        .select(['like.subject as uri', countAll.as('likeCount')]),
    )
    .onConflict((oc) =>
      oc
        .column('uri')
        .doUpdateSet({ likeCount: sql`${excluded('likeCount')}` }),
    )

  const replyCountQb = db
    .insertInto('post_agg')
    .columns(['uri', 'replyCount'])
    .expression((exp) =>
      exp
        .selectFrom('post')
        .where('replyParent', 'is not', null)
        .groupBy('post.replyParent')
        .select(['post.replyParent as uri', countAll.as('replyCount')]),
    )
    .onConflict((oc) =>
      oc
        .column('uri')
        .doUpdateSet({ replyCount: sql`${excluded('replyCount')}` }),
    )

  const repostCountQb = db
    .insertInto('post_agg')
    .columns(['uri', 'repostCount'])
    .expression((exp) =>
      exp
        .selectFrom('repost')
        .groupBy('repost.subject')
        .select(['repost.subject as uri', countAll.as('repostCount')]),
    )
    .onConflict((oc) =>
      oc
        .column('uri')
        .doUpdateSet({ repostCount: sql`${excluded('repostCount')}` }),
    )

  const followersCountQb = db
    .insertInto('profile_agg')
    .columns(['did', 'followersCount'])
    .expression((exp) =>
      exp
        .selectFrom('follow')
        .groupBy('follow.subjectDid')
        .select(['follow.subjectDid as did', countAll.as('followersCount')]),
    )
    .onConflict((oc) =>
      oc
        .column('did')
        .doUpdateSet({ followersCount: sql`${excluded('followersCount')}` }),
    )

  const followsCountQb = db
    .insertInto('profile_agg')
    .columns(['did', 'followsCount'])
    .expression((exp) =>
      exp
        .selectFrom('follow')
        .groupBy('follow.creator')
        .select(['follow.creator as did', countAll.as('followsCount')]),
    )
    .onConflict((oc) =>
      oc
        .column('did')
        .doUpdateSet({ followsCount: sql`${excluded('followsCount')}` }),
    )

  const postsCountQb = db
    .insertInto('profile_agg')
    .columns(['did', 'postsCount'])
    .expression((exp) =>
      exp
        .selectFrom('post')
        .groupBy('post.creator')
        .select(['post.creator as did', countAll.as('postsCount')]),
    )
    .onConflict((oc) =>
      oc
        .column('did')
        .doUpdateSet({ postsCount: sql`${excluded('postsCount')}` }),
    )

  return [
    likeCountQb.compile().sql,
    replyCountQb.compile().sql,
    repostCountQb.compile().sql,
    followersCountQb.compile().sql,
    followsCountQb.compile().sql,
    postsCountQb.compile().sql,
  ].join(';\n\n')
}

const countAll = sql<number>`count(*)`

type Schema = {
  post_agg: PostAgg
  profile_agg: ProfileAgg
  like: Like
  follow: Follow
  post: Post
  repost: Repost
}

interface PostAgg {
  uri: string
  likeCount: Generated<number>
  replyCount: Generated<number>
  repostCount: Generated<number>
}

interface ProfileAgg {
  did: string
  followersCount: Generated<number>
  followsCount: Generated<number>
  postsCount: Generated<number>
}

interface Like {
  subject: string
}

interface Follow {
  creator: string
  subjectDid: string
}

interface Post {
  creator: string
  replyParent: string | null
}

interface Repost {
  subject: string
}
