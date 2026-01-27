import { isDidString } from '@atproto/lex'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { app } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.graph.getRelationships, {
    handler: async ({ params }) => {
      const { actor, others = [] } = params

      // @TODO Should this be validated at the schema level?
      if (!isDidString(actor) || !others.every(isDidString)) {
        throw new InvalidRequestError('Invalid DID format')
      }

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
          ? app.bsky.graph.defs.relationship.$build({
              did,
              following: subject.following,
              followedBy: subject.followedBy,
              blocking: subject.blocking,
              blockedBy: subject.blockedBy,
              blockingByList: subject.blockingByList,
              blockedByList: subject.blockedByList,
            })
          : app.bsky.graph.defs.notFoundActor.$build({
              actor: did,
              notFound: true,
            })
      })
      return {
        encoding: 'application/json',
        body: {
          actor,
          relationships,
        },
      } satisfies app.bsky.graph.getRelationships.Output
    },
  })
}
