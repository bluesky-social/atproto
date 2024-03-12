import { DataPlaneClient } from '../data-plane/client'
import { Label } from '../lexicon/types/com/atproto/label/defs'
import { Record as LabelerRecord } from '../lexicon/types/app/bsky/labeler/service'
import {
  HydrationMap,
  RecordInfo,
  parseJsonBytes,
  parseRecord,
  parseString,
} from './util'
import { AtUri } from '@atproto/syntax'
import { ids } from '../lexicon/lexicons'
import { ParsedLabelers } from '../util'

export type { Label } from '../lexicon/types/com/atproto/label/defs'

export type SubjectLabels = {
  isTakendown: boolean
  labels: Label[]
}

export type Labels = HydrationMap<SubjectLabels>

export type LabelerAgg = {
  likes: number
}

export type LabelerAggs = HydrationMap<LabelerAgg>

export type Labeler = RecordInfo<LabelerRecord>
export type Labelers = HydrationMap<Labeler>

export type LabelerViewerState = {
  like?: string
}

export type LabelerViewerStates = HydrationMap<LabelerViewerState>

export class LabelHydrator {
  constructor(public dataplane: DataPlaneClient) {}

  async getLabelsForSubjects(
    subjects: string[],
    labelers: ParsedLabelers,
  ): Promise<Labels> {
    if (!subjects.length || !labelers.dids.length)
      return new HydrationMap<SubjectLabels>()
    const res = await this.dataplane.getLabels({
      subjects,
      issuers: labelers.dids,
    })
    return res.labels.reduce((acc, cur) => {
      const parsed = parseJsonBytes(cur) as Label | undefined
      if (!parsed || parsed.neg) return acc
      const { sig: _, ...label } = parsed
      let entry = acc.get(label.uri)
      if (!entry) {
        entry = {
          isTakendown: false,
          labels: [],
        }
        acc.set(label.uri, entry)
      }
      entry.labels.push(label)
      if (
        TAKEDOWN_LABELS.includes(label.val) &&
        !label.neg &&
        labelers.redact.has(label.src)
      ) {
        entry.isTakendown = true
      }
      return acc
    }, new HydrationMap<SubjectLabels>())
  }

  async getLabelers(
    dids: string[],
    includeTakedowns = false,
  ): Promise<Labelers> {
    const res = await this.dataplane.getLabelerRecords({
      uris: dids.map(labelerDidToUri),
    })
    return dids.reduce((acc, did, i) => {
      const record = parseRecord<LabelerRecord>(
        res.records[i],
        includeTakedowns,
      )
      return acc.set(did, record ?? null)
    }, new HydrationMap<Labeler>())
  }

  async getLabelerViewerStates(
    dids: string[],
    viewer: string,
  ): Promise<LabelerViewerStates> {
    const likes = await this.dataplane.getLikesByActorAndSubjects({
      actorDid: viewer,
      refs: dids.map((did) => ({ uri: labelerDidToUri(did) })),
    })
    return dids.reduce((acc, did, i) => {
      return acc.set(did, {
        like: parseString(likes.uris[i]),
      })
    }, new HydrationMap<LabelerViewerState>())
  }

  async getLabelerAggregates(dids: string[]): Promise<LabelerAggs> {
    const refs = dids.map((did) => ({ uri: labelerDidToUri(did) }))
    const counts = await this.dataplane.getInteractionCounts({ refs })
    return dids.reduce((acc, did, i) => {
      return acc.set(did, {
        likes: counts.likes[i] ?? 0,
      })
    }, new HydrationMap<LabelerAgg>())
  }
}

const labelerDidToUri = (did: string): string => {
  return AtUri.make(did, ids.AppBskyLabelerService, 'self').toString()
}

const TAKEDOWN_LABELS = ['!takedown', '!suspend']
