import { Server } from '../../../../lexicon'
import { FeedKeyset } from '../util/feed'
import { paginate } from '../../../../db/pagination'
import AppContext from '../../../../context'
import DatabaseSchema from '../../../../db/database-schema'

async function resolveDids(
  db: DatabaseSchema,
  actors: string[],
): Promise<string[]> {
  let dids: string[] = []
  // get handles
  dids.push(...actors.filter((actor) => actor.startsWith('did:')))
  let handles = actors.filter((actor) => !actor.startsWith('did:'))
  if (handles.length > 0) {
    const actorsRes = await db
      .selectFrom('actor')
      .select('did')
      .where('handle', 'in', handles)
      .execute()
    if (actorsRes) {
      dids.push(...actorsRes.map((actor) => actor.did))
    }
  }
  return dids
}

async function filterBlocks(
  ctx: AppContext,
  viewer: string,
  dids: string[],
): Promise<string[]> {
  const blockInfo = await ctx.services
    .graph(ctx.db)
    .getBlocksMulti(viewer, dids)
  let skipDids: Set<string> = new Set()
  if (blockInfo.blockingList.length > 0) {
    for (const block of blockInfo.blockingList) {
      skipDids.add(block.did)
    }
  }
  if (blockInfo.blockedByList.length > 0) {
    for (const block of blockInfo.blockedByList) {
      skipDids.add(block.did)
    }
  }
  if (skipDids.size > 0) {
    dids = dids.filter((did) => !skipDids.has(did))
  }
  return dids
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getAuthorFeeds({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const { actors, limit, cursor } = params
      const viewer = auth.credentials.did
      const db = ctx.db.db
      const { ref } = db.dynamic

      const feedService = ctx.services.feed(ctx.db)
      const graphService = ctx.services.graph(ctx.db)

      let dids: string[] = await resolveDids(db, actors)

      if (viewer !== null) {
        dids = await filterBlocks(ctx, viewer, dids)
      }

      let feedItemsQb = feedService
        .selectFeedItemQb()
        .where('originatorDid', 'in', dids)

      if (viewer !== null) {
        feedItemsQb = feedItemsQb.where((qb) =>
          // Hide reposts of muted content
          qb
            .where('type', '=', 'post')
            .orWhere((qb) =>
              graphService.whereNotMuted(qb, viewer, [ref('post.creator')]),
            ),
        )
      }

      const keyset = new FeedKeyset(
        ref('feed_item.sortAt'),
        ref('feed_item.cid'),
      )

      feedItemsQb = paginate(feedItemsQb, {
        limit,
        cursor,
        keyset,
      })

      const feedItems = await feedItemsQb.execute()
      const feed = await feedService.hydrateFeed(feedItems, viewer)

      return {
        encoding: 'application/json',
        body: {
          feed,
          cursor: keyset.packFromResult(feedItems),
        },
      }
    },
  })
}
