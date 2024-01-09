import { DataPlaneClient } from '../data-plane/client'
import { Label } from '../lexicon/types/com/atproto/label/defs'
import { Record as LabelerRecord } from '../lexicon/types/app/bsky/mod/labeler'
import {
  HydrationMap,
  RecordInfo,
  parseJsonBytes,
  parseRecord,
  parseString,
} from './util'

export type { Label } from '../lexicon/types/com/atproto/label/defs'

export type Labels = HydrationMap<Label[]>

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
    issuers: string[],
  ): Promise<Labels> {
    const res = await this.dataplane.getLabels({ subjects, issuers })
    return res.labels.reduce((acc, cur) => {
      const label = parseJsonBytes(cur) as Label | undefined
      if (!label) return acc
      const entry = acc.get(label.uri)
      if (entry) {
        entry.push(label)
      } else {
        acc.set(label.uri, [label])
      }
      return acc
    }, new HydrationMap<Label[]>())
  }

  async getLabelers(
    uris: string[],
    includeTakedowns = false,
  ): Promise<Labelers> {
    const res = await this.dataplane.getLabelerRecords({ uris })
    return uris.reduce((acc, uri, i) => {
      const record = parseRecord<LabelerRecord>(
        res.records[i],
        includeTakedowns,
      )
      return acc.set(uri, record ?? null)
    }, new HydrationMap<Labeler>())
  }

  async getLabelerViewerStates(
    uris: string[],
    viewer: string,
  ): Promise<LabelerViewerStates> {
    const likes = await this.dataplane.getLikesByActorAndSubjects({
      actorDid: viewer,
      refs: uris.map((uri) => ({ uri })),
    })
    return uris.reduce((acc, uri, i) => {
      return acc.set(uri, {
        like: parseString(likes.uris[i]),
      })
    }, new HydrationMap<LabelerViewerState>())
  }

  async getLabelerAggregates(uris: string[]): Promise<LabelerAggs> {
    const refs = uris.map((uri) => ({ uri }))
    const likes = await this.dataplane.getLikeCounts({ refs })
    return uris.reduce((acc, uri, i) => {
      return acc.set(uri, {
        likes: likes.counts[i] ?? 0,
      })
    }, new HydrationMap<LabelerAgg>())
  }
}
