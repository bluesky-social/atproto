import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context.js'
import { Server } from '../../lexicon/index.js'
import { ids } from '../../lexicon/lexicons.js'

export default function (server: Server, ctx: AppContext) {
  server.chat.bsky.moderation.getConvoMembers({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      if (!ctx.chatAgent) {
        throw new InvalidRequestError('No chat agent configured')
      }
      const res = await ctx.chatAgent.api.chat.bsky.moderation.getConvoMembers(
        params,
        await ctx.chatAuth(ids.ChatBskyModerationGetConvoMembers),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}
