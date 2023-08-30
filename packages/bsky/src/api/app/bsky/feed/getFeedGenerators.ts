import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { FeedGenInfo, FeedService } from '../../../../services/feed'
import { createPipeline, noRules } from '../../../../pipeline'
import { ActorInfoMap, ActorService } from '../../../../services/actor'
import { Database } from '../../../../db'

export default function (server: Server, ctx: AppContext) {
  const getFeedGenerators = createPipeline(
    () => {
      const db = ctx.db.getReplica()
      return {
        db,
        feedService: ctx.services.feed(db),
        actorService: ctx.services.actor(db),
      }
    },
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
      const feedViews = await getFeedGenerators({ feeds, viewer })
      return {
        encoding: 'application/json',
        body: {
          feeds: feedViews,
        },
      }
    },
  })
}

async function skeleton(params: Params, ctx: Context) {
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

async function hydration(state: SkeletonState, ctx: Context) {
  const { actorService } = ctx
  const profiles = await actorService.views.profiles(
    state.generators.map((gen) => gen.creator),
    state.params.viewer,
  )
  return {
    ...state,
    profiles,
  }
}

function presentation(state: HydrationState, ctx: Context) {
  const { feedService } = ctx
  return state.generators.map((gen) =>
    feedService.views.formatFeedGeneratorView(gen, state.profiles),
  )
}

type Context = {
  db: Database
  feedService: FeedService
  actorService: ActorService
}

type Params = { viewer: string | null; feeds: string[] }

type SkeletonState = { params: Params; generators: FeedGenInfo[] }

type HydrationState = SkeletonState & { profiles: ActorInfoMap }
