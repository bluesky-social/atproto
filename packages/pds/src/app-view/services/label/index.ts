import { AtUri } from '@atproto/uri'
import Database from '../../../db'
import { Label } from '../../../lexicon/types/com/atproto/label/defs'
import { ids } from '../../../lexicon/lexicons'

export type Labels = Record<string, Label[]>

export class LabelService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new LabelService(db)
  }

  async getLabelsForSubjects(subjects: string[]): Promise<Labels> {
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
        cid: cur.subjectCid ?? undefined,
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
      AtUri.make(did, ids.AppBskyActorProfile, 'self').toString(),
    )
    const subjects = [...dids, ...profileUris]
    const labels = await this.getLabelsForSubjects(subjects)
    // combine labels for profile + did
    return Object.keys(labels).reduce((acc, cur) => {
      const did = cur.startsWith('at://') ? new AtUri(cur).hostname : cur
      acc[did] ??= []
      acc[did] = [...acc[did], ...labels[cur]]
      return acc
    }, {} as Labels)
  }

  async getLabels(subject: string): Promise<Label[]> {
    const labels = await this.getLabelsForSubjects([subject])
    return labels[subject] ?? []
  }

  async getLabelsForProfile(did: string): Promise<Label[]> {
    const labels = await this.getLabelsForProfiles([did])
    return labels[did] ?? []
  }
}
