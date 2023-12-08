import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../gen/bsky_connect'
import { Database } from '../../../db'
import * as ui8 from 'uint8arrays'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getLabels(req) {
    // @TODO add in issues param
    const { subjects } = req
    if (subjects.length === 0) {
      return { records: [] }
    }
    const res = await db.db
      .selectFrom('label')
      .where('uri', 'in', subjects)
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
