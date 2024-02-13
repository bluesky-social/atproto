import { DataPlaneClient } from '../data-plane/client'
import { Label } from '../lexicon/types/com/atproto/label/defs'
import { Record as ModServiceRecord } from '../lexicon/types/app/bsky/moderation/service'
import {
  HydrationMap,
  RecordInfo,
  parseJsonBytes,
  parseRecord,
  parseString,
} from './util'
import { AtUri } from '@atproto/syntax'
import { ids } from '../lexicon/lexicons'

export type { Label } from '../lexicon/types/com/atproto/label/defs'

export type Labels = HydrationMap<Label[]>

export type ModServiceAgg = {
  likes: number
}

export type ModServiceAggs = HydrationMap<ModServiceAgg>

export type ModService = RecordInfo<ModServiceRecord>
export type ModServices = HydrationMap<ModService>

export type ModServiceViewerState = {
  like?: string
}

export type ModServiceViewerStates = HydrationMap<ModServiceViewerState>

export class LabelHydrator {
  constructor(
    public dataplane: DataPlaneClient,
    public opts?: { labelsFromIssuerDids?: string[] },
  ) {}

  async getLabelsForSubjects(
    subjects: string[],
    issuers?: string[],
  ): Promise<Labels> {
    issuers = ([] as string[])
      .concat(issuers ?? [])
      .concat(this.opts?.labelsFromIssuerDids ?? [])
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

  async getModServices(
    dids: string[],
    includeTakedowns = false,
  ): Promise<ModServices> {
    const res = await this.dataplane.getModServiceRecords({
      uris: dids.map(modServiceDidToUri),
    })
    return dids.reduce((acc, did, i) => {
      const record = parseRecord<ModServiceRecord>(
        res.records[i],
        includeTakedowns,
      )
      return acc.set(did, record ?? null)
    }, new HydrationMap<ModService>())
  }

  async getModServiceViewerStates(
    dids: string[],
    viewer: string,
  ): Promise<ModServiceViewerStates> {
    const likes = await this.dataplane.getLikesByActorAndSubjects({
      actorDid: viewer,
      refs: dids.map((did) => ({ uri: modServiceDidToUri(did) })),
    })
    return dids.reduce((acc, did, i) => {
      return acc.set(did, {
        like: parseString(likes.uris[i]),
      })
    }, new HydrationMap<ModServiceViewerState>())
  }

  async getModServiceAggregates(dids: string[]): Promise<ModServiceAggs> {
    const refs = dids.map((did) => ({ uri: modServiceDidToUri(did) }))
    const likes = await this.dataplane.getLikeCounts({ refs })
    return dids.reduce((acc, did, i) => {
      return acc.set(did, {
        likes: likes.counts[i] ?? 0,
      })
    }, new HydrationMap<ModServiceAgg>())
  }
}

const modServiceDidToUri = (did: string): string => {
  return AtUri.make(did, ids.AppBskyModerationService, 'self').toString()
}
