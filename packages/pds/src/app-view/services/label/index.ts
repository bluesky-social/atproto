import { AtUri } from '@atproto/uri'
import Database from '../../../db'
import { Label } from '../../../lexicon/types/com/atproto/label/defs'

export type Labels = Record<string, Label[]>

export class LabelService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new LabelService(db)
  }

  async getLabels(subjects: string[]): Promise<Labels> {
    if (subjects.length < 1) return {}
    const res = await this.db.db
      .selectFrom('label')
      .where('label.subjectUri', 'in', subjects)
      .selectAll()
      .execute()
    return res.reduce((acc, cur) => {
      acc[cur.subjectUri] ??= []
      acc[cur.subjectUri].push({
        src: cur.sourceDid,
        uri: cur.subjectUri,
        cid: cur.subjectCid,
        val: cur.value,
        neg: cur.negated === 1, // @TODO update in appview
        cts: cur.createdAt,
      })
      return acc
    }, {} as Labels)
  }

  async getLabelsForProfiles(dids: string[]): Promise<Labels> {
    if (dids.length < 1) return {}
    const profileUris = dids.map((did) =>
      AtUri.make(did, 'app.bsky.feed.profile', 'self').toString(),
    )
    const subjects = [...dids, ...profileUris]
    return this.getLabels(subjects)
  }
}
