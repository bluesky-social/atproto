import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getRepostedBy'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { Database } from '../../../../db'
import { ActorService } from '../../../../services/actor'
import { createPipeline } from '../../../../pipeline'
import {
  FeedHydrationState,
  FeedRow,
  FeedService,
} from '../../../../services/feed'

export default function (server: Server, ctx: AppContext) {
  const getPostQuotes = createPipeline(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )
  server.app.bsky.feed.getPostQuotes({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth }) => {
      const db = ctx.db.getReplica()
      const feedService = ctx.services.feed(db)
      const actorService = ctx.services.actor(db)
      const viewer = auth.credentials.iss

      const result = await getPostQuotes(
        { ...params, viewer },
        { db, feedService, actorService },
      )

      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}

const skeleton = async (
  params: Params,
  ctx: Context,
): Promise<SkeletonState> => {
  const { db } = ctx
  const { limit, cursor, uri, cid } = params
  const { ref } = db.db.dynamic

  if (TimeCidKeyset.clearlyBad(cursor)) {
    return { params, feedItems: [] }
  }

  let builder = db.db
    .selectFrom('quote')
    .where('quote.subject', '=', uri)
    .select(['quote.uri', 'quote.cid', 'quote.sortAt'])

  if (cid) {
    builder = builder.where('quote.subjectCid', '=', cid)
  }

  const keyset = new TimeCidKeyset(ref('quote.sortAt'), ref('quote.cid'))
  builder = paginate(builder, {
    limit,
    cursor,
    keyset,
  })

  const quotes = await builder.execute()
  const uris = quotes.map((q) => q.uri)
  const feedItems = await ctx.feedService.postUrisToFeedItems(uris)
  return { params, feedItems, cursor: keyset.packFromResult(quotes) }
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

const noBlocks = (state: HydrationState) => {
  const { viewer } = state.params
  state.feedItems = state.feedItems.filter((item) => {
    if (!viewer) return true
    return !state.bam.block([viewer, item.postAuthorDid])
  })
  return state
}

const presentation = (state: HydrationState, ctx: Context) => {
  const { feedService, actorService } = ctx
  const { params, feedItems, cursor, profiles } = state
  const { uri, cid } = params
  const actors = actorService.views.profileBasicPresentation(
    Object.keys(profiles),
    state,
    params.viewer,
  )
  const postViews = feedItems.flatMap((item) => {
    return (
      feedService.views.formatPostView(
        item.postUri,
        actors,
        state.posts,
        state.threadgates,
        state.embeds,
        state.labels,
        state.lists,
        params.viewer,
      ) ?? []
    )
  })
  return { posts: postViews, cursor, uri, cid }
}

type Context = {
  db: Database
  feedService: FeedService
  actorService: ActorService
}

type Params = QueryParams & { viewer: string | null }

type SkeletonState = {
  params: Params
  feedItems: FeedRow[]
  cursor?: string
}

type HydrationState = SkeletonState & FeedHydrationState
