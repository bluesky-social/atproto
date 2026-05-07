import { TID } from '@atproto/common'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { app } from '../../../../lexicons/index.js'
import { Namespaces } from '../../../../stash'
import { assertRolodexOrThrowUnimplemented } from './util'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.contact.sendNotification, {
    auth: ctx.authVerifier.role,
    handler: async ({ input }) => {
      // Assert rolodex even though we don't call it, it is a proxy to whether the app is configured with contact import support.
      assertRolodexOrThrowUnimplemented(ctx)

      const { from, to } = input.body

      await ctx.stashClient.create({
        actorDid: from,
        namespace: Namespaces.AppBskyContactDefsNotification,
        payload: {
          from,
          to,
        } satisfies app.bsky.contact.defs.Notification,
        key: TID.nextStr(),
      })

      return {
        encoding: 'application/json',
        body: {},
      }
    },
  })
}
