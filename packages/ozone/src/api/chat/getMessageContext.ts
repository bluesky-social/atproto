import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { ids } from '../../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  server.chat.bsky.moderation.getMessageContext({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, auth }) => {
      if (!ctx.chatAgent) {
        throw new InvalidRequestError('No chat agent configured')
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
        .where('action', '=', 'tools.ozone.moderation.defs#modEventReport')
        .limit(1)
        .executeTakeFirst()
      if (!found) {
        throw new InvalidRequestError('No report for requested message')
      }

      const res =
        await ctx.chatAgent.api.chat.bsky.moderation.getMessageContext(
          { ...params, before, after },
          await ctx.chatAuth(ids.ChatBskyModerationGetMessageContext),
        )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}
