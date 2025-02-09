import { AtUri } from '@atproto/syntax'
import { DataPlaneClient } from '../data-plane/client'
import { ids } from '../lexicon/lexicons'
import { Record as LabelerRecord } from '../lexicon/types/app/bsky/labeler/service'
import { Label } from '../lexicon/types/com/atproto/label/defs'
import { ParsedLabelers } from '../util'
import {
  HydrationMap,
  Merges,
  RecordInfo,
  parseJsonBytes,
  parseRecord,
  parseString,
} from './util'

export type { Label } from '../lexicon/types/com/atproto/label/defs'

export type SubjectLabels = {
  isTakendown: boolean
  needsReview: boolean
  labels: HydrationMap<Label> // src + val -> label
}

export class Labels extends HydrationMap<SubjectLabels> implements Merges {
  static key(label: Label) {
    return `${label.src}::${label.val}`
  }
  merge(map: Labels): this {
    map.forEach((theirs, key) => {
      if (!theirs) return
      const mine = this.get(key)
      if (mine) {
        mine.isTakendown = mine.isTakendown || theirs.isTakendown
        mine.labels = mine.labels.merge(theirs.labels)
      } else {
        this.set(key, theirs)
      }
    })
    return this
  }
  getBySubject(sub: string): Label[] {
    const it = this.get(sub)?.labels.values()
    if (!it) return []
    const labels: Label[] = []
    for (const label of it) {
      if (label) labels.push(label)
    }
    return labels
  }
}

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
    if (!subjects.length || !labelers.dids.length) return new Labels()
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
          needsReview: false,
          labels: new HydrationMap(),
        }
        acc.set(label.uri, entry)
      }
      const isActionableNeedsReview =
        label.val === NEEDS_REVIEW_LABEL &&
        !label.neg &&
        labelers.redact.has(label.src)

      // we action needs review labels on backend for now so don't send to client until client has proper logic for them
      if (!isActionableNeedsReview) {
        entry.labels.set(Labels.key(label), label)
      }

      if (
        TAKEDOWN_LABELS.includes(label.val) &&
        !label.neg &&
        labelers.redact.has(label.src)
      ) {
        entry.isTakendown = true
      }
      if (isActionableNeedsReview) {
        entry.needsReview = true
      }
      return acc
    }, new Labels())
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
const NEEDS_REVIEW_LABEL = 'needs-review'
