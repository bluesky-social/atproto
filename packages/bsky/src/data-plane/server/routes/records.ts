import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../gen/bsky_connect'
import * as ui8 from 'uint8arrays'
import { Database } from '../../../db'
import { keyBy } from '@atproto/common'
import { Record } from '../../gen/bsky_pb'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  getBlockRecords: getRecords(db),
  getFeedGeneratorRecords: getRecords(db),
  getFollowRecords: getRecords(db),
  getLikeRecords: getRecords(db),
  getListBlockRecords: getRecords(db),
  getListItemRecords: getRecords(db),
  getListRecords: getRecords(db),
  getPostRecords: getRecords(db),
  getProfileRecords: getRecords(db),
  getRepostRecords: getRecords(db),
  getThreadGateRecords: getRecords(db),
})

const getRecords =
  (db: Database) =>
  async (req: { uris: string[] }): Promise<{ records: Record[] }> => {
    if (req.uris.length === 0) {
      return { records: [] }
    }
    const res = await db.db
      .selectFrom('record')
      .selectAll()
      .where('uri', 'in', req.uris)
      .execute()
    const byUri = keyBy(res, 'uri')
    const records: Record[] = req.uris.map((uri) => {
      const row = byUri[uri]
      const json = row ? row.json : JSON.stringify(null)
      const recordBytes = ui8.fromString(json, 'utf8')
      return new Record({
        record: recordBytes,
        cid: row.cid,
        indexedAt: {
          nanos: new Date(row.indexedAt).getTime() * 1000,
        },
      })
    })
    return { records }
  }
