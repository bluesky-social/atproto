import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { FeedGenInfo, FeedService } from '../../../../services/feed'
import { createPipeline, noRules } from '../../../../pipeline'
import { ActorInfoMap, ActorService } from '../../../../services/actor'
import { Database } from '../../../../db'

export default function (server: Server, ctx: AppContext) {
  const getFeedGenerators = createPipeline(
    skeleton,
    hydration,
    noRules,
    presentation,
  )
  server.app.bsky.feed.getFeedGenerators({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const { feeds } = params
      const viewer = auth.credentials.did
      const db = ctx.db.getReplica()
      const feedService = ctx.services.feed(db)
      const actorService = ctx.services.actor(db)

      const view = await getFeedGenerators(
        { feeds, viewer },
        { db, feedService, actorService },
      )

      return {
        encoding: 'application/json',
        body: view,
      }
    },
  })
}

const skeleton = async (params: Params, ctx: Context) => {
  const { feedService } = ctx
  const genInfos = await feedService.getFeedGeneratorInfos(
    params.feeds,
    params.viewer,
  )
  return {
    params,
    generators: Object.values(genInfos),
  }
}

const hydration = async (state: SkeletonState, ctx: Context) => {
  const { actorService } = ctx
  const profiles = await actorService.views.profilesBasic(
    state.generators.map((gen) => gen.creator),
    state.params.viewer,
  )
  return {
    ...state,
    profiles,
  }
}

const presentation = (state: HydrationState, ctx: Context) => {
  const { feedService } = ctx
  const feeds = state.generators.map((gen) =>
    feedService.views.formatFeedGeneratorView(gen, state.profiles),
  )
  return { feeds }
}

type Context = {
  db: Database
  feedService: FeedService
  actorService: ActorService
}

type Params = { viewer: string | null; feeds: string[] }

type SkeletonState = { params: Params; generators: FeedGenInfo[] }

type HydrationState = SkeletonState & { profiles: ActorInfoMap }
