import type { ServiceImpl } from '@connectrpc/connect'
import type { Service } from '../../../proto/bsky_connect.js'
import type { Database } from '../db/index.js'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getLatestRev(req) {
    const res = await db.db
      .selectFrom('actor_sync')
      .where('did', '=', req.actorDid)
      .select('repoRev')
      .executeTakeFirst()
    return {
      rev: res?.repoRev ?? undefined,
    }
  },
})
