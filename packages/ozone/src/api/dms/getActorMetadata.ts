import { Server } from '../../lexicon'
import AppContext from '../../context'

export default function (server: Server, ctx: AppContext) {
  server.chat.bsky.moderation.getActorMetadata({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      return {} as any
    },
  })
}
