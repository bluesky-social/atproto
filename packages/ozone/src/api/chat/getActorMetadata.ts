import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { ids } from '../../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  server.chat.bsky.moderation.getActorMetadata({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      if (!ctx.chatAgent) {
        throw new InvalidRequestError('No chat agent configured')
      }
      const res = await ctx.chatAgent.api.chat.bsky.moderation.getActorMetadata(
        params,
        await ctx.chatAuth(ids.ChatBskyModerationGetActorMetadata),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}
