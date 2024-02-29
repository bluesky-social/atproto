import * as ui8 from 'uint8arrays'
import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getLabels(req) {
    const { subjects, issuers } = req
    if (subjects.length === 0 || issuers.length === 0) {
      return { records: [] }
    }
    const res = await db.db
      .selectFrom('label')
      .where('uri', 'in', subjects)
      .where('src', 'in', issuers)
      .selectAll()
      .execute()

    const labels = res.map((l) => {
      const formatted = {
        ...l,
        cid: l.cid === '' ? undefined : l.cid,
      }
      return ui8.fromString(JSON.stringify(formatted), 'utf8')
    })
    return { labels }
  },
})
