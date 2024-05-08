import { Server } from '../../lexicon'
import AppContext from '../../context'
import { pipethrough } from '../../pipethrough'

export default function (server: Server, ctx: AppContext) {
  server.chat.bsky.moderation.getActorMetadata({
    auth: ctx.authVerifier.access,
    handler: async ({ req, auth }) => {
      const requester = auth.credentials.did
      return pipethrough(ctx, req, requester)
    },
  })
  server.chat.bsky.moderation.getMessageContext({
    auth: ctx.authVerifier.access,
    handler: async ({ req, auth }) => {
      const requester = auth.credentials.did
      return pipethrough(ctx, req, requester)
    },
  })
}
