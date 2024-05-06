import { Server } from '../../lexicon'
import AppContext from '../../context'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.chat.bsky.moderation.getMessageContext({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, auth }) => {
      if (!ctx.chatAgent) {
        throw new InvalidRequestError('No chat agent configured')
      }
      if (!auth.credentials.isModerator) {
        if (params.after > 0 || params.before > 0) {
          throw new AuthRequiredError(
            'Must be a full moderator to view context window',
          )
        }
      }
      if (params.after > 5 || params.before > 5) {
        throw new InvalidRequestError(
          'Cannot view a context window larger than 5',
        )
      }
      const res =
        await ctx.chatAgent.api.chat.bsky.moderation.getMessageContext(
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
