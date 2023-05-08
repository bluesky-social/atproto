import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<Schema>): Promise<void> {
  // schema migration
  await db.schema
    .alterTable('post')
    .addColumn('replyBlocked', 'int2', (col) => col.defaultTo(0).notNull())
    .execute()
  await db.schema
    .alterTable('post_embed_record')
    .addColumn('blocked', 'int2', (col) => col.defaultTo(0).notNull())
    .execute()
  // data migration
  const { ref } = db.dynamic
  const blockPair = sql`(${ref('actor_block.creator')}, ${ref(
    'actor_block.subjectDid',
  )})`
  // embed blocked when there's a block relationship between poster and embed author
  const postEmbedPair = sql`(${ref('post.creator')}, ${ref('embed.creator')})`
  const embedPostPair = sql`(${ref('embed.creator')}, ${ref('post.creator')})`
  await db
    .updateTable('post_embed_record as update_embed')
    .set({ blocked: 1 })
    .whereExists((qb) =>
      qb
        .selectFrom('post_embed_record as match_embed')
        .selectAll()
        .innerJoin('post', 'post.uri', 'match_embed.postUri')
        .innerJoin('post as embed', 'embed.uri', 'match_embed.embedUri')
        .innerJoin('actor_block', (join) =>
          join.onRef(
            blockPair,
            'in',
            sql`(${postEmbedPair}, ${embedPostPair})`,
          ),
        )
        .whereRef('update_embed.postUri', '=', 'match_embed.postUri')
        .whereRef('update_embed.embedUri', '=', 'match_embed.embedUri'),
    )
    .execute()

  // reply blocked when there's a block relationship between poster and reply author
  const postReplyPair = sql`(${ref('parent.creator')}, ${ref(
    'match_reply.creator',
  )})`
  const replyPostPair = sql`(${ref('match_reply.creator')}, ${ref(
    'parent.creator',
  )})`
  await db
    .updateTable('post as update_post')
    .set({ replyBlocked: 1 })
    .whereExists((qb) =>
      qb
        .selectFrom('post as match_reply')
        .selectAll()
        .innerJoin('post as parent', 'parent.uri', 'match_reply.replyParent')
        .innerJoin('actor_block', (join) =>
          join.onRef(
            blockPair,
            'in',
            sql`(${postReplyPair}, ${replyPostPair})`,
          ),
        )
        .whereRef('update_post.uri', '=', 'match_reply.uri'),
    )
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('post').dropColumn('replyBlocked').execute()
  await db.schema
    .alterTable('post_embed_record')
    .dropColumn('blocked')
    .execute()
}

type Schema = {
  post: Post
  post_embed_record: PostEmbedRecord
  actor_block: ActorBlock
}

interface PostEmbedRecord {
  postUri: string
  embedUri: string
  embedCid: string
  blocked: 0 | 1
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
  replyBlocked: 0 | 1
  createdAt: string
  indexedAt: string
}

interface ActorBlock {
  uri: string
  cid: string
  creator: string
  subjectDid: string
  createdAt: string
  indexedAt: string
}
