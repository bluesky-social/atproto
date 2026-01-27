import { AtUri, AtUriString, DidString, UriString } from '@atproto/syntax'
import { DataPlaneClient } from '../data-plane/client'
import { ParsedLabelers } from '../util'
import { Label, LabelerRecord } from '../views/types.js'
import {
  HydrationMap,
  Merges,
  RecordInfo,
  parseJsonBytes,
  parseRecord,
  parseString,
} from './util'

export type { Label }

export type SubjectLabels = {
  isImpersonation: boolean
  isTakendown: boolean
  needsReview: boolean
  labels: HydrationMap<Label, `${string}::${string}`> // src + val -> label
}

export class Labels
  extends HydrationMap<SubjectLabels, UriString>
  implements Merges
{
  static key(label: Label): `${string}::${string}` {
    return `${label.src}::${label.val}`
  }
  merge(map: Labels): this {
    for (const [key, theirs] of map) {
      if (!theirs) continue
      const mine = this.get(key)
      if (mine) {
        mine.isTakendown = mine.isTakendown || theirs.isTakendown
        mine.labels = mine.labels.merge(theirs.labels)
      } else {
        this.set(key, theirs)
      }
    }
    return this
  }
  getBySubject(sub: UriString): Label[] {
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

export type LabelerAggs = HydrationMap<LabelerAgg, DidString>

export type Labeler = RecordInfo<LabelerRecord>
export type Labelers = HydrationMap<Labeler, DidString>

export type LabelerViewerState = {
  like?: AtUriString
}

export type LabelerViewerStates = HydrationMap<LabelerViewerState, DidString>

export class LabelHydrator {
  constructor(public dataplane: DataPlaneClient) {}

  async getLabelsForSubjects(
    subjects: string[],
    labelers: ParsedLabelers,
  ): Promise<Labels> {
    const map = new Labels()

    if (!subjects.length || !labelers.dids.length) return map

    const res = await this.dataplane.getLabels({
      subjects,
      issuers: labelers.dids,
    })

    for (const cur of res.labels) {
      const parsed = parseJsonBytes(cur) as Label | undefined
      if (!parsed || parsed.neg) continue
      const { sig: _, ...label } = parsed
      let entry = map.get(label.uri)
      if (!entry) {
        entry = {
          isImpersonation: false,
          isTakendown: false,
          needsReview: false,
          labels: new HydrationMap(),
        }
        map.set(label.uri, entry)
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
      if (
        label.val === IMPERSONATION_LABEL &&
        !label.neg &&
        labelers.redact.has(label.src)
      ) {
        entry.isImpersonation = true
      }
    }

    return map
  }

  async getLabelers(
    dids: DidString[],
    includeTakedowns = false,
  ): Promise<Labelers> {
    const map: Labelers = new HydrationMap()

    if (dids.length) {
      const res = await this.dataplane.getLabelerRecords({
        uris: dids.map(labelerDidToUri),
      })
      for (let i = 0; i < dids.length; i++) {
        const did = dids[i]
        const record = parseRecord<LabelerRecord>(
          res.records[i],
          includeTakedowns,
        )
        map.set(did, record ?? null)
      }
    }

    return map
  }

  async getLabelerViewerStates(
    dids: DidString[],
    viewer: string,
  ): Promise<LabelerViewerStates> {
    const map: LabelerViewerStates = new HydrationMap()

    if (dids.length) {
      const likes = await this.dataplane.getLikesByActorAndSubjects({
        actorDid: viewer,
        refs: dids.map((did) => ({ uri: labelerDidToUri(did) })),
      })

      for (let i = 0; i < dids.length; i++) {
        const did = dids[i]
        map.set(did, {
          like: parseString(likes.uris[i]),
        })
      }
    }

    return map
  }

  async getLabelerAggregates(
    dids: DidString[],
    viewer: string | null,
  ): Promise<LabelerAggs> {
    const map: LabelerAggs = new HydrationMap()
    if (dids.length) {
      const refs = dids.map((did) => ({ uri: labelerDidToUri(did) }))
      const counts = await this.dataplane.getInteractionCounts({
        refs,
        skipCacheForDids: viewer ? [viewer] : undefined,
      })
      for (let i = 0; i < dids.length; i++) {
        const did = dids[i]
        map.set(did, {
          likes: counts.likes[i] ?? 0,
        })
      }
    }
    return map
  }
}

const labelerDidToUri = (did: DidString): AtUriString => {
  return AtUri.make(did, 'app.bsky.labeler.service', 'self').toString()
}

const IMPERSONATION_LABEL = 'impersonation'
const TAKEDOWN_LABELS = ['!takedown', '!suspend']
const NEEDS_REVIEW_LABEL = 'needs-review'
