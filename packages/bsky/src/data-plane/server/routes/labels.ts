import * as ui8 from 'uint8arrays'
import { noUndefinedVals } from '@atproto/common'
import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'
import { Selectable } from 'kysely'
import { Label } from '../db/tables/label'

type LabelRow = Selectable<Label>

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getLabels(req) {
    const { subjects, issuers } = req
    if (subjects.length === 0 || issuers.length === 0) {
      return { labels: [] }
    }
    const res: LabelRow[] = await db.db
      .selectFrom('label')
      .where('uri', 'in', subjects)
      .where('src', 'in', issuers)
      .selectAll()
      .execute()

    const labelsBySubject = new Map<string, LabelRow[]>()
    res.forEach((l) => {
      const labels = labelsBySubject.get(l.uri) ?? []
      labels.push(l)
      labelsBySubject.set(l.uri, labels)
    })

    // intentionally duplicate label results, appview frontend should be defensive to this
    const labels = subjects.flatMap((sub) => {
      const labelsForSub = labelsBySubject.get(sub) ?? []
      return labelsForSub.map((l) => {
        const formatted = noUndefinedVals({
          ...l,
          cid: l.cid === '' ? undefined : l.cid,
          neg: l.neg === true ? true : undefined,
        })
        return ui8.fromString(JSON.stringify(formatted), 'utf8')
      })
    })

    return { labels }
  },

  async getAllLabelers() {
    throw new Error('not implemented')
  },
})
