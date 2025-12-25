import { TID } from '@atproto/common'
import { AppContext } from '../../context'
import { Event as AgeAssuranceEvent } from '../../lexicon/types/app/bsky/ageassurance/defs'
import { Namespaces } from '../../stash'

export async function createEvent(
  ctx: AppContext,
  actorDid: string,
  event: Omit<AgeAssuranceEvent, 'createdAt'>,
) {
  const payload: AgeAssuranceEvent = {
    createdAt: new Date().toISOString(),
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
