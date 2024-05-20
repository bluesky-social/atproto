import { Record as FollowRecord } from '../lexicon/types/app/bsky/graph/follow'
import { Record as BlockRecord } from '../lexicon/types/app/bsky/graph/block'
import { Record as ListRecord } from '../lexicon/types/app/bsky/graph/list'
import { Record as ListItemRecord } from '../lexicon/types/app/bsky/graph/listitem'
import { DataPlaneClient } from '../data-plane/client'
import { HydrationMap, RecordInfo, parseRecord } from './util'
import { FollowInfo } from '../proto/bsky_pb'

export type List = RecordInfo<ListRecord>
export type Lists = HydrationMap<List>

export type ListItem = RecordInfo<ListItemRecord>
export type ListItems = HydrationMap<ListItem>

export type ListViewerState = {
  viewerMuted?: string
  viewerListBlockUri?: string
  viewerInList?: string
}

export type ListViewerStates = HydrationMap<ListViewerState>

export type Follow = RecordInfo<FollowRecord>
export type Follows = HydrationMap<Follow>

export type Block = RecordInfo<BlockRecord>

export type RelationshipPair = [didA: string, didB: string]

const dedupePairs = (pairs: RelationshipPair[]): RelationshipPair[] => {
  const mapped = pairs.reduce(
    (acc, cur) => {
      const sorted = ([...cur] as RelationshipPair).sort()
      acc[sorted.join('-')] = sorted
      return acc
    },
    {} as Record<string, RelationshipPair>,
  )
  return Object.values(mapped)
}

export class Blocks {
  _blocks: Map<string, boolean> = new Map()
  constructor() {}

  static key(didA: string, didB: string): string {
    return [didA, didB].sort().join(',')
  }

  set(didA: string, didB: string, exists: boolean): Blocks {
    const key = Blocks.key(didA, didB)
    this._blocks.set(key, exists)
    return this
  }

  has(didA: string, didB: string): boolean {
    const key = Blocks.key(didA, didB)
    return this._blocks.has(key)
  }

  isBlocked(didA: string, didB: string): boolean {
    if (didA === didB) return false // ignore self-blocks
    const key = Blocks.key(didA, didB)
    return this._blocks.get(key) ?? false
  }

  merge(blocks: Blocks): Blocks {
    blocks._blocks.forEach((exists, key) => {
      this._blocks.set(key, exists)
    })
    return this
  }
}

export class GraphHydrator {
  constructor(public dataplane: DataPlaneClient) {}

  async getLists(uris: string[], includeTakedowns = false): Promise<Lists> {
    if (!uris.length) return new HydrationMap<List>()
    const res = await this.dataplane.getListRecords({ uris })
    return uris.reduce((acc, uri, i) => {
      const record = parseRecord<ListRecord>(res.records[i], includeTakedowns)
      return acc.set(uri, record ?? null)
    }, new HydrationMap<List>())
  }

  // @TODO may not be supported yet by data plane
  async getListItems(
    uris: string[],
    includeTakedowns = false,
  ): Promise<ListItems> {
    if (!uris.length) return new HydrationMap<ListItem>()
    const res = await this.dataplane.getListItemRecords({ uris })
    return uris.reduce((acc, uri, i) => {
      const record = parseRecord<ListItemRecord>(
        res.records[i],
        includeTakedowns,
      )
      return acc.set(uri, record ?? null)
    }, new HydrationMap<ListItem>())
  }

  async getListViewerStates(
    uris: string[],
    viewer: string,
  ): Promise<ListViewerStates> {
    if (!uris.length) return new HydrationMap<ListViewerState>()
    const mutesAndBlocks = await Promise.all(
      uris.map((uri) => this.getMutesAndBlocks(uri, viewer)),
    )
    const listMemberships = await this.dataplane.getListMembership({
      actorDid: viewer,
      listUris: uris,
    })
    return uris.reduce((acc, uri, i) => {
      return acc.set(uri, {
        viewerMuted: mutesAndBlocks[i].muted ? uri : undefined,
        viewerListBlockUri: mutesAndBlocks[i].listBlockUri || undefined,
        viewerInList: listMemberships.listitemUris[i],
      })
    }, new HydrationMap<ListViewerState>())
  }

  private async getMutesAndBlocks(uri: string, viewer: string) {
    const [muted, listBlockUri] = await Promise.all([
      this.dataplane.getMutelistSubscription({
        actorDid: viewer,
        listUri: uri,
      }),
      this.dataplane.getBlocklistSubscription({
        actorDid: viewer,
        listUri: uri,
      }),
    ])
    return {
      muted: muted.subscribed,
      listBlockUri: listBlockUri.listblockUri,
    }
  }

  async getBidirectionalBlocks(pairs: RelationshipPair[]): Promise<Blocks> {
    if (!pairs.length) return new Blocks()
    const deduped = dedupePairs(pairs).map(([a, b]) => ({ a, b }))
    const res = await this.dataplane.getBlockExistence({ pairs: deduped })
    const blocks = new Blocks()
    for (let i = 0; i < deduped.length; i++) {
      const pair = deduped[i]
      blocks.set(pair.a, pair.b, res.exists[i] ?? false)
    }
    return blocks
  }

  async getFollows(uris: string[], includeTakedowns = false): Promise<Follows> {
    if (!uris.length) return new HydrationMap<Follow>()
    const res = await this.dataplane.getFollowRecords({ uris })
    return uris.reduce((acc, uri, i) => {
      const record = parseRecord<FollowRecord>(res.records[i], includeTakedowns)
      return acc.set(uri, record ?? null)
    }, new HydrationMap<Follow>())
  }

  async getBlocks(uris: string[], includeTakedowns = false): Promise<Follows> {
    if (!uris.length) return new HydrationMap<Block>()
    const res = await this.dataplane.getBlockRecords({ uris })
    return uris.reduce((acc, uri, i) => {
      const record = parseRecord<BlockRecord>(res.records[i], includeTakedowns)
      return acc.set(uri, record ?? null)
    }, new HydrationMap<Block>())
  }

  async getActorFollows(input: {
    did: string
    cursor?: string
    limit?: number
  }): Promise<{ follows: FollowInfo[]; cursor: string }> {
    const { did, cursor, limit } = input
    const res = await this.dataplane.getFollows({
      actorDid: did,
      cursor,
      limit,
    })
    return { follows: res.follows, cursor: res.cursor }
  }

  async getActorFollowers(input: {
    did: string
    cursor?: string
    limit?: number
  }): Promise<{ followers: FollowInfo[]; cursor: string }> {
    const { did, cursor, limit } = input
    const res = await this.dataplane.getFollowers({
      actorDid: did,
      cursor,
      limit,
    })
    return { followers: res.followers, cursor: res.cursor }
  }
}
