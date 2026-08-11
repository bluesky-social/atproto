import { sql } from 'kysely'
import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/sokaa_connect'
import { Database } from '../db'
import { IndexedAtDidKeyset, paginate } from '../db/pagination'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async searchActors(req) {
    const term = cleanQuery(req.term)
    const limit = req.limit > 0 ? req.limit : 25
    const { cursor } = req
    if (!term) {
      return { dids: [], cursor: undefined }
    }

    const { ref } = db.db.dynamic
    const pattern = `${escapeLike(term)}%`
    let builder = db.db
      .selectFrom('actor')
      .where('actor.upstreamStatus', '=', 'active')
      .where(
        sql<boolean>`(actor.handle ilike ${pattern} escape '\\' or actor."displayName" ilike ${pattern} escape '\\')`,
      )
      .select(['actor.did', 'actor.indexedAt'])

    const keyset = new IndexedAtDidKeyset(
      ref('actor.indexedAt'),
      ref('actor.did'),
    )
    builder = paginate(builder, {
      limit,
      cursor,
      keyset,
      tryIndex: true,
    })

    const res = await builder.execute()
    return {
      dids: res.map((row) => row.did),
      cursor: keyset.packFromResult(res),
    }
  },
})

/** Trim and strip a leading @ for handle-style queries. */
export function cleanQuery(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase()
}

function escapeLike(value: string): string {
  return value.replace(/([\\%_])/g, '\\$1')
}
