import { TID } from '@atproto/common'
import type { DatetimeString } from '@atproto/syntax'
import type { AppContext } from '../../context.js'
import type { app } from '../../lexicons/index.js'
import { Namespaces } from '../../stash.js'

export async function createEvent(
  ctx: AppContext,
  actorDid: string,
  event: Omit<app.bsky.ageassurance.defs.Event, 'createdAt'>,
) {
  const payload: app.bsky.ageassurance.defs.Event = {
    createdAt: new Date().toISOString() as DatetimeString,
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
