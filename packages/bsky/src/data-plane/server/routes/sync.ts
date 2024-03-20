import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'

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
