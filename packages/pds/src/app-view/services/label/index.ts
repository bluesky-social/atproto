import { AtUri } from '@atproto/uri'
import Database from '../../../db'
import { Label } from '../../../lexicon/types/com/atproto/label/defs'
import { ids } from '../../../lexicon/lexicons'
import { sql } from 'kysely'

export type Labels = Record<string, Label[]>

export class LabelService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new LabelService(db)
  }

  async formatAndCreate(
    src: string,
    uri: string,
    cid: string | null,
    labels: { create?: string[]; negate?: string[] },
  ) {
    const { create = [], negate = [] } = labels
    const toCreate = create.map((val) => ({
      src,
      uri,
      cid: cid ?? undefined,
      val,
      neg: false,
      cts: new Date().toISOString(),
    }))
    const toNegate = negate.map((val) => ({
      src,
      uri,
      cid: cid ?? undefined,
      val,
      neg: true,
      cts: new Date().toISOString(),
    }))
    await this.createLabels([...toCreate, ...toNegate])
  }

  async createLabels(labels: Label[]) {
    if (labels.length < 1) return
    const dbVals = labels.map((l) => ({
      ...l,
      cid: l.cid ?? '',
      neg: (l.neg ? 1 : 0) as 1 | 0,
    }))
    const { ref } = this.db.db.dynamic
    const excluded = (col: string) => ref(`excluded.${col}`)
    await this.db.db
      .insertInto('label')
      .values(dbVals)
      .onConflict((oc) =>
        oc.columns(['src', 'uri', 'cid', 'val']).doUpdateSet({
          neg: sql`${excluded('neg')}`,
          cts: sql`${excluded('cts')}`,
        }),
      )
      .execute()
  }

  async getLabelsForSubjects(subjects: string[]): Promise<Labels> {
    if (subjects.length < 1) return {}
    const res = await this.db.db
      .selectFrom('label')
      .where('label.uri', 'in', subjects)
      .selectAll()
      .execute()
    return res.reduce((acc, cur) => {
      acc[cur.uri] ??= []
      acc[cur.uri].push({
        ...cur,
        cid: cur.cid === '' ? undefined : cur.cid,
        neg: cur.neg === 1, // @TODO update in appview
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
