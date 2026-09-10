import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { chat } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(chat.bsky.moderation.getConvos, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      if (!ctx.chatClient) {
        throw new InvalidRequestError('No chat service configured')
      }
      const body = await ctx.chatClient.call(
        chat.bsky.moderation.getConvos,
        params,
        await ctx.chatAuth(chat.bsky.moderation.getConvos.$lxm),
      )
      return {
        encoding: 'application/json',
        body,
      }
    },
  })
}
