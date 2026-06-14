import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/sokaa_connect'
import { Database } from '../db'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getActors(req) {
    const { dids } = req
    if (dids.length === 0) {
      return { actors: [] }
    }
    const rows = await db.db
      .selectFrom('actor')
      .where('did', 'in', dids)
      .selectAll()
      .execute()
    const byDid = new Map(rows.map((row) => [row.did, row]))
    return {
      actors: dids.map((did) => {
        const row = byDid.get(did)
        if (!row) {
          return { exists: false }
        }
        return {
          exists: true,
          handle: row.handle ?? undefined,
          displayName: row.displayName ?? undefined,
          description: row.description ?? undefined,
          avatarCid: row.avatarCid ?? undefined,
          bannerCid: row.bannerCid ?? undefined,
          followersCount: row.followersCount,
          postsCount: row.postsCount,
          upstreamStatus: row.upstreamStatus,
          indexedAt: row.indexedAt,
        }
      }),
    }
  },
})
