import { sha256Hex } from '@atproto/crypto'

export async function didToStatsigUser(did: string) {
  const userID = await sha256Hex(did)
  return {
    userID,
  }
}

export const gates = {
  newSuggestedFollowsByActor: 'new_sugg_foll_by_actor',
}
