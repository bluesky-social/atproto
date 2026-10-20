import {
  type AtUriString,
  type DidString,
  type UriString,
  atUri,
} from '@atproto/lex'
import type { DataPlaneClient } from '../data-plane/client/index.js'
import { app, com } from '../lexicons/index.js'
import type { ParsedLabelers } from '../util.js'
import type { Label, LabelerRecord } from '../views/types.js'
import {
  HydrationMap,
  type Merges,
  type RecordInfo,
  parseJsonBytes,
  parseRecord,
  parseString,
} from './util.js'

export type { Label }

export type SubjectLabels = {
  isImpersonation: boolean
  isTakendown: boolean
  needsReview: boolean
  labels: HydrationMap<`${string}::${string}`, Label> // src + val -> label
}

export class Labels
  extends HydrationMap<UriString, SubjectLabels>
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
        mine.needsReview = mine.needsReview || theirs.needsReview
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

export type LabelerAggs = HydrationMap<DidString, LabelerAgg>

export type Labeler = RecordInfo<LabelerRecord>
export type Labelers = HydrationMap<DidString, Labeler>

export type LabelerViewerState = {
  like?: AtUriString
}

export type LabelerViewerStates = HydrationMap<DidString, LabelerViewerState>

export class LabelHydrator {
  constructor(
    public dataplane: DataPlaneClient,
    private needsReviewTagSources: readonly DidString[] = [],
  ) {}

  async getLabelsForSubjects(
    subjects: UriString[],
    labelers: ParsedLabelers,
  ): Promise<Labels> {
    const map = new Labels()

    if (!subjects.length || !labelers.dids.length) return map

    const sources = this.needsReviewTagSources.filter(
      (source) => labelers.dids.includes(source) && labelers.redact.has(source),
    )
    const [res, tagRes] = await Promise.all([
      this.dataplane.getLabels({ subjects, issuers: labelers.dids }),
      sources.length
        ? this.dataplane.getTagsForSubjects({ subjects, sources })
        : undefined,
    ])

    for (const cur of res.labels) {
      const parsed = parseJsonBytes(com.atproto.label.defs.label, cur)
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

    if (tagRes) {
      const requestedSubjects = new Set<string>(subjects)
      const now = Date.now()
      for (const tag of tagRes.tags) {
        if (
          tag.value !== NEEDS_REVIEW_LABEL ||
          tag.removed ||
          !tag.event ||
          !sources.includes(tag.event.source as DidString) ||
          !requestedSubjects.has(tag.subject) ||
          (tag.expiresAt && tag.expiresAt.toDate().getTime() <= now)
        ) {
          continue
        }
        const subject = tag.subject as UriString
        const entry = map.get(subject)
        if (entry) {
          entry.needsReview = true
        } else {
          map.set(subject, {
            isImpersonation: false,
            isTakendown: false,
            needsReview: true,
            labels: new HydrationMap(),
          })
        }
      }
    }

    return map
  }

  async getLabelers(
    dids: DidString[],
    includeTakedowns = false,
  ): Promise<Labelers> {
    const map: Labelers = new HydrationMap()
    if (!dids.length) return map

    const res = await this.dataplane.getLabelerRecords({
      uris: dids.map(labelerDidToUri),
    })
    for (let i = 0; i < dids.length; i++) {
      const did = dids[i]
      const record = parseRecord(
        app.bsky.labeler.service.main,
        res.records[i],
        includeTakedowns,
      )
      map.set(did, record ?? null)
    }

    return map
  }

  async getLabelerViewerStates(
    dids: DidString[],
    viewer: DidString,
  ): Promise<LabelerViewerStates> {
    const map: LabelerViewerStates = new HydrationMap()
    if (!dids.length) return map

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

    return map
  }

  async getLabelerAggregates(
    dids: DidString[],
    viewer: DidString | null,
  ): Promise<LabelerAggs> {
    const map: LabelerAggs = new HydrationMap()
    if (!dids.length) return map

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

    return map
  }
}

function labelerDidToUri<T extends DidString>(did: T) {
  return atUri(did, app.bsky.labeler.service)
}

const IMPERSONATION_LABEL = 'impersonation'
const TAKEDOWN_LABELS = ['!takedown', '!suspend']
const NEEDS_REVIEW_LABEL = 'needs-review'
