import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { chat, tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(chat.bsky.moderation.getMessageContext, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, auth }) => {
      if (!ctx.chatClient) {
        throw new InvalidRequestError('No chat service configured')
      }
      const maxWindowSize = auth.credentials.isModerator ? 5 : 0
      const before = Math.min(maxWindowSize, params.before)
      const after = Math.min(maxWindowSize, params.after)

      // Ensure that the requested message was actually reported to prevent arbitrary lookups
      const found = await ctx.db.db
        .selectFrom('moderation_event')
        .select('id')
        .where('subjectMessageId', '=', params.messageId)
        // uses "moderation_event_message_id_idx" index
        .where('subjectMessageId', 'is not', null)
        .where('action', '=', tools.ozone.moderation.defs.modEventReport.$type)
        .limit(1)
        .executeTakeFirst()
      if (!found) {
        throw new InvalidRequestError('No report for requested message')
      }

      const body = await ctx.chatClient.call(
        chat.bsky.moderation.getMessageContext,
        { ...params, before, after },
        await ctx.chatAuth(chat.bsky.moderation.getMessageContext.$lxm),
      )
      return {
        encoding: 'application/json',
        body,
      }
    },
  })
}
