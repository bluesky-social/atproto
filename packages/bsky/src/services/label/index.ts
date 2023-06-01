import { AtUri } from '@atproto/uri'
import Database from '../../db'
import { Label } from '../../lexicon/types/com/atproto/label/defs'
import { ids } from '../../lexicon/lexicons'
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
      neg: !!l.neg,
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

  async getLabelsForUris(
    subjects: string[],
    includeNeg?: boolean,
  ): Promise<Labels> {
    if (subjects.length < 1) return {}
    const res = await this.db.db
      .selectFrom('label')
      .where('label.uri', 'in', subjects)
      .if(!includeNeg, (qb) => qb.where('neg', '=', false))
      .selectAll()
      .execute()
    return res.reduce((acc, cur) => {
      acc[cur.uri] ??= []
      acc[cur.uri].push({
        ...cur,
        cid: cur.cid === '' ? undefined : cur.cid,
        neg: cur.neg,
      })
      return acc
    }, {} as Labels)
  }

  // gets labels for any record. when did is present, combine labels for both did & profile record.
  async getLabelsForSubjects(
    subjects: string[],
    includeNeg?: boolean,
  ): Promise<Labels> {
    if (subjects.length < 1) return {}
    const expandedSubjects = subjects.flatMap((subject) => {
      if (subject.startsWith('did:')) {
        return [
          subject,
          AtUri.make(subject, ids.AppBskyActorProfile, 'self').toString(),
        ]
      }
      return subject
    })
    const labels = await this.getLabelsForUris(expandedSubjects, includeNeg)
    return Object.keys(labels).reduce((acc, cur) => {
      const uri = cur.startsWith('at://') ? new AtUri(cur) : null
      if (
        uri &&
        uri.collection === ids.AppBskyActorProfile &&
        uri.rkey === 'self'
      ) {
        // combine labels for profile + did
        const did = uri.hostname
        acc[did] ??= []
        acc[did].push(...labels[cur])
      }
      acc[cur] ??= []
      acc[cur].push(...labels[cur])
      return acc
    }, {} as Labels)
  }

  async getLabels(subject: string, includeNeg?: boolean): Promise<Label[]> {
    const labels = await this.getLabelsForUris([subject], includeNeg)
    return labels[subject] ?? []
  }

  async getLabelsForProfile(
    did: string,
    includeNeg?: boolean,
  ): Promise<Label[]> {
    const labels = await this.getLabelsForSubjects([did], includeNeg)
    return labels[did] ?? []
  }
}
