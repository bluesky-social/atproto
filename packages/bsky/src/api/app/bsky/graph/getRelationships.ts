import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { app } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.graph.getRelationships, {
    handler: async ({ params }) => {
      const { others = [] } = params

      const [actor] = await ctx.hydrator.actor.getDids([params.actor])
      if (!actor || others.length < 1) {
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

      const relationships = others.map((actor) => {
        const subject = res.get(actor)
        return subject
          ? app.bsky.graph.defs.relationship.$build({
              did: subject.did,
              following: subject.following,
              followedBy: subject.followedBy,
              blocking: subject.blocking,
              blockedBy: subject.blockedBy,
              blockingByList: subject.blockingByList,
              blockedByList: subject.blockedByList,
            })
          : app.bsky.graph.defs.notFoundActor.$build({
              actor,
              notFound: true,
            })
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
