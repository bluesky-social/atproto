import { TID } from '@atproto/common'
import { toDatetimeString } from '@atproto/syntax'
import { AppContext } from '../../context'
import { app } from '../../lexicons/index.js'
import { Namespaces } from '../../stash'

export async function createEvent(
  ctx: AppContext,
  actorDid: string,
  event: Omit<app.bsky.ageassurance.defs.Event, 'createdAt'>,
) {
  const payload: app.bsky.ageassurance.defs.Event = {
    createdAt: toDatetimeString(new Date()),
    ...event,
  }
  await ctx.stashClient.create({
    actorDid: actorDid,
    namespace: Namespaces.AppBskyAgeassuranceDefsEvent,
    key: TID.nextStr(),
    payload,
  })
  return payload
}
