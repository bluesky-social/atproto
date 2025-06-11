import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getRelationships({
    handler: async ({ params }) => {
      const { actor, others = [] } = params
      if (others.length < 1) {
        return {
          encoding: 'application/json',
          body: {
            actor,
            relationships: [],
          },
        }
      }
      const res = await ctx.hydrator.actor.getProfileViewerStatesNaive(
        others,
        actor,
      )
      const relationships = others.map((did) => {
        const subject = res.get(did)
        return subject
          ? {
              $type: 'app.bsky.graph.defs#relationship',
              did,
              following: subject.following,
              followedBy: subject.followedBy,
            }
          : {
              $type: 'app.bsky.graph.defs#notFoundActor',
              actor: did,
              notFound: true,
            }
      })
      return {
        encoding: 'application/json',
        body: {
          actor,
          relationships,
        },
      }
    },
  })
}
