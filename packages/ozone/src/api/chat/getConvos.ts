import { InvalidRequestError } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import type { Server } from '../../lexicon/index.js'
import { ids } from '../../lexicon/lexicons.js'

export default function (server: Server, ctx: AppContext) {
  server.chat.bsky.moderation.getConvos({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      if (!ctx.chatAgent) {
        throw new InvalidRequestError('No chat agent configured')
      }
      const res = await ctx.chatAgent.api.chat.bsky.moderation.getConvos(
        params,
        await ctx.chatAuth(ids.ChatBskyModerationGetConvos),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}
