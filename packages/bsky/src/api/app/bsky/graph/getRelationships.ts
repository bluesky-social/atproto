import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getRelationships({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ req, auth, params }) => {
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

      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)

      const { hydrator } = await ctx.createRequestContent({
        viewer,
        labelers,
      })

      const res = await hydrator.actor.getProfileViewerStatesNaive(
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
