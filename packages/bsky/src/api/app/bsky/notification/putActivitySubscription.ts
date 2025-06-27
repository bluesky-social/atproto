import { TID } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { isActivitySubscriptionEnabled } from '../../../../hydration/util'
import { Server } from '../../../../lexicon'
import { Namespaces } from '../../../../stash'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.notification.putActivitySubscription({
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth }) => {
      const actorDid = auth.credentials.iss
      const { subject, activitySubscription } = input.body
      if (actorDid === subject) {
        throw new InvalidRequestError('Cannot subscribe to own activity')
      }

      const existingKey = await getExistingKey(ctx, actorDid, subject)
      const enabled = isActivitySubscriptionEnabled(activitySubscription)

      const stashInput = {
        actorDid,
        namespace:
          Namespaces.AppBskyNotificationDefsSubjectActivitySubscription,
        payload: {
          subject,
          activitySubscription,
        },
        key: existingKey ?? TID.nextStr(),
      }

      if (existingKey) {
        if (enabled) {
          await ctx.stashClient.update(stashInput)
        } else {
          await ctx.stashClient.delete(stashInput)
        }
      } else {
        if (enabled) {
          await ctx.stashClient.create(stashInput)
        } else {
          // no-op: subscription already doesn't exist
        }
      }

      return {
        encoding: 'application/json',
        body: {
          subject,
          activitySubscription: enabled ? activitySubscription : undefined,
        },
      }
    },
  })
}

const getExistingKey = async (
  ctx: AppContext,
  actorDid: string,
  subject: string,
): Promise<string | null> => {
  const res = await ctx.dataplane.getActivitySubscriptionsByActorAndSubjects({
    actorDid,
    subjectDids: [subject],
  })
  const [existing] = res.subscriptions
  const key = existing.key
  return key || null
}
