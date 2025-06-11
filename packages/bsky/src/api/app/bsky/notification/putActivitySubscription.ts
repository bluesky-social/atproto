import { TID } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { SubjectActivitySubscription } from '../../../../lexicon/types/app/bsky/notification/defs'
import { NamespaceAppBskyNotificationDefsSubjectActivitySubscription } from '../../../../stash'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.putActivitySubscription({
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth }) => {
      const actorDid = auth.credentials.iss
      const {
        subject,
        key: existingKey,
        activitySubscription: { post, reply },
      } = input.body

      if (actorDid === subject) {
        throw new InvalidRequestError('Cannot subscribe to own activity')
      }

      const payload: SubjectActivitySubscription = {
        subject,
        activitySubscription: { post, reply },
      }
      const key = existingKey ?? TID.nextStr()
      const stashInput = {
        actorDid,
        namespace: NamespaceAppBskyNotificationDefsSubjectActivitySubscription,
        payload,
        key,
      }

      if (existingKey) {
        await ctx.stashClient.update(stashInput)
      } else {
        await ctx.stashClient.create(stashInput)
      }
      return {
        encoding: 'application/json',
        body: {
          key,
        },
      }
    },
  })
}
