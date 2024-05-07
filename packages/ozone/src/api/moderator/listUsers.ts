import { Server } from '../../lexicon'
import AppContext from '../../context'
import { ProfileViewDetailed } from '../../lexicon/types/app/bsky/actor/defs'
import { chunkArray } from '@atproto/common'

// In memory cache for profiles. Current assumption is that the list shouldn't be big enough for this to be an issue in the near term
const profileCache = new Map<string, ProfileViewDetailed>()

export default function (server: Server, ctx: AppContext) {
  // getProfiles() only allows 25 DIDs at a time so we need to query in chunks
  const getProfiles = async (dids: string[]): Promise<void> => {
    const uncachedDids = dids.filter((did) => !profileCache.get(did))
    if (!uncachedDids.length) return
    const headers = await ctx.appviewAuth()

    for (const actors of chunkArray(uncachedDids, 25)) {
      const { data } = await ctx.appviewAgent.api.app.bsky.actor.getProfiles(
        { actors },
        headers,
      )

      data.profiles.forEach((profile) => {
        profileCache.set(profile.did, profile)
      })
    }
  }
  server.tools.ozone.moderator.listUsers({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async () => {
      const moderatorService = ctx.moderatorService(ctx.db)
      const list = await moderatorService.list()

      if (list?.length) {
        await getProfiles(list.map((item) => item.did))
      }

      return {
        encoding: 'application/json',
        body: {
          cursor: '',
          users: list.map((item) => {
            const profile = profileCache.get(item.did)
            return {
              ...item,
              profile,
            }
          }),
        },
      }
    },
  })
}
