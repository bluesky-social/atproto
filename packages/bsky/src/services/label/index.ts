import { sql } from 'kysely'
import { AtUri } from '@atproto/syntax'
import { toSimplifiedISOSafe } from '@atproto/common'
import { Database } from '../../db'
import { Label, isSelfLabels } from '../../lexicon/types/com/atproto/label/defs'
import { ids } from '../../lexicon/lexicons'
import { LabelCache } from '../../label-cache'

export type Labels = Record<string, Label[]>

export class LabelService {
  constructor(public db: Database, public cache: LabelCache | null) {}

  static creator(cache: LabelCache | null) {
    return (db: Database) => new LabelService(db, cache)
  }

  async formatAndCreate(
    src: string,
    uri: string,
    cid: string | null,
    labels: { create?: string[]; negate?: string[] },
  ): Promise<Label[]> {
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
    const formatted = [...toCreate, ...toNegate]
    await this.createLabels(formatted)
    return formatted
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
    await this.db
      .asPrimary()
      .db.insertInto('label')
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
    opts?: {
      includeNeg?: boolean
      skipCache?: boolean
    },
  ): Promise<Labels> {
    if (subjects.length < 1) return {}
    const res =
      this.cache === null || opts?.skipCache
        ? await this.db.db
            .selectFrom('label')
            .where('label.uri', 'in', subjects)
            .if(!opts?.includeNeg, (qb) => qb.where('neg', '=', false))
            .selectAll()
            .execute()
        : this.cache.forSubjects(subjects, opts?.includeNeg)
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
    opts?: {
      includeNeg?: boolean
      skipCache?: boolean
    },
    labels: Labels = {},
  ): Promise<Labels> {
    if (subjects.length < 1) return labels
    const expandedSubjects = subjects.flatMap((subject) => {
      if (labels[subject]) return [] // skip over labels we already have fetched
      if (subject.startsWith('did:')) {
        return [
          subject,
          AtUri.make(subject, ids.AppBskyActorProfile, 'self').toString(),
        ]
      }
      return subject
    })
    const labelsByUri = await this.getLabelsForUris(expandedSubjects, opts)
    return Object.keys(labelsByUri).reduce((acc, cur) => {
      const uri = cur.startsWith('at://') ? new AtUri(cur) : null
      if (
        uri &&
        uri.collection === ids.AppBskyActorProfile &&
        uri.rkey === 'self'
      ) {
        // combine labels for profile + did
        const did = uri.hostname
        acc[did] ??= []
        acc[did].push(...labelsByUri[cur])
      }
      acc[cur] ??= []
      acc[cur].push(...labelsByUri[cur])
      return acc
    }, labels)
  }

  async getLabels(
    subject: string,
    opts?: {
      includeNeg?: boolean
      skipCache?: boolean
    },
  ): Promise<Label[]> {
    const labels = await this.getLabelsForUris([subject], opts)
    return labels[subject] ?? []
  }

  async getLabelsForProfile(
    did: string,
    opts?: {
      includeNeg?: boolean
      skipCache?: boolean
    },
  ): Promise<Label[]> {
    const labels = await this.getLabelsForSubjects([did], opts)
    return labels[did] ?? []
  }
}

export function getSelfLabels(details: {
  uri: string | null
  cid: string | null
  record: Record<string, unknown> | null
}): Label[] {
  const { uri, cid, record } = details
  if (!uri || !cid || !record) return []
  if (!isSelfLabels(record.labels)) return []
  const src = new AtUri(uri).host // record creator
  const cts =
    typeof record.createdAt === 'string'
      ? toSimplifiedISOSafe(record.createdAt)
      : new Date(0).toISOString()
  return record.labels.values.map(({ val }) => {
    return { src, uri, cid, val, cts, neg: false }
  })
}
