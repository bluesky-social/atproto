import { TID } from '@atproto/common'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { Notification } from '../../../../lexicon/types/app/bsky/contact/defs'
import { Namespaces } from '../../../../stash'
import { assertRolodexOrThrowUnimplemented } from './util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.contact.sendNotification({
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
        } satisfies Notification,
        key: TID.nextStr(),
      })

      return {
        encoding: 'application/json',
        body: {},
      }
    },
  })
}
