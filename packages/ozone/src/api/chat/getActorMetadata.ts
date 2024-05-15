import { Server } from '../../lexicon'
import AppContext from '../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.chat.bsky.moderation.getActorMetadata({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      if (!ctx.chatAgent) {
        throw new InvalidRequestError('No chat agent configured')
      }
      const res = await ctx.chatAgent.api.chat.bsky.moderation.getActorMetadata(
        params,
        await ctx.chatAuth(),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}
