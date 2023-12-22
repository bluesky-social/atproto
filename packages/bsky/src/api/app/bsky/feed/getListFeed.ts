import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getListFeed'
import { FeedKeyset, getFeedDateThreshold } from '../util/feed'
import { paginate } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { setRepoRev } from '../../../util'
import { Database } from '../../../../db'
import {
  FeedHydrationState,
  FeedRow,
  FeedService,
} from '../../../../services/feed'
import { ActorService } from '../../../../services/actor'
import { GraphService } from '../../../../services/graph'
import { createPipeline } from '../../../../pipeline'

export default function (server: Server, ctx: AppContext) {
  const getListFeed = createPipeline(
    skeleton,
    hydration,
    noBlocksOrMutes,
    presentation,
  )
  server.app.bsky.feed.getListFeed({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, res }) => {
      const viewer = auth.credentials.iss
      const db = ctx.db.getReplica()
      const actorService = ctx.services.actor(db)
      const feedService = ctx.services.feed(db)
      const graphService = ctx.services.graph(db)

      const [result, repoRev] = await Promise.all([
        getListFeed(
          { ...params, viewer },
          { db, actorService, feedService, graphService },
        ),
        actorService.getRepoRev(viewer),
      ])

      setRepoRev(res, repoRev)

      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}

export const skeleton = async (
  params: Params,
  ctx: Context,
): Promise<SkeletonState> => {
  const { list, cursor, limit } = params
  const { db } = ctx
  const { ref } = db.db.dynamic

  const keyset = new FeedKeyset(ref('post.sortAt'), ref('post.cid'))
  const sortFrom = keyset.unpack(cursor)?.primary

  let builder = ctx.feedService
    .selectPostQb()
    .innerJoin('list_item', 'list_item.subjectDid', 'post.creator')
    .where('list_item.listUri', '=', list)
    .where('post.sortAt', '>', getFeedDateThreshold(sortFrom, 3))

  builder = paginate(builder, {
    limit,
    cursor,
    keyset,
    tryIndex: true,
  })
  const feedItems = await builder.execute()

  return {
    params,
    feedItems,
    cursor: keyset.packFromResult(feedItems),
  }
}

const hydration = async (state: SkeletonState, ctx: Context) => {
  const { feedService } = ctx
  const { params, feedItems } = state
  const refs = feedService.feedItemRefs(feedItems)
  const hydrated = await feedService.feedHydration({
    ...refs,
    viewer: params.viewer,
  })
  return { ...state, ...hydrated }
}

const noBlocksOrMutes = (state: HydrationState) => {
  const { viewer } = state.params
  if (!viewer) return state
  state.feedItems = state.feedItems.filter(
    (item) =>
      !state.bam.block([viewer, item.postAuthorDid]) &&
      !state.bam.mute([viewer, item.postAuthorDid]),
  )
  return state
}

const presentation = (state: HydrationState, ctx: Context) => {
  const { feedService } = ctx
  const { feedItems, cursor, params } = state
  const feed = feedService.views.formatFeed(feedItems, state, params.viewer)
  return { feed, cursor }
}

type Context = {
  db: Database
  actorService: ActorService
  feedService: FeedService
  graphService: GraphService
}

type Params = QueryParams & { viewer: string | null }

type SkeletonState = {
  params: Params
  feedItems: FeedRow[]
  cursor?: string
}

type HydrationState = SkeletonState & FeedHydrationState
