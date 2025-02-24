import { DataPlaneClient } from '../data-plane/client'
import { Record as BlockRecord } from '../lexicon/types/app/bsky/graph/block'
import { Record as FollowRecord } from '../lexicon/types/app/bsky/graph/follow'
import { Record as ListRecord } from '../lexicon/types/app/bsky/graph/list'
import { Record as ListItemRecord } from '../lexicon/types/app/bsky/graph/listitem'
import { Record as StarterPackRecord } from '../lexicon/types/app/bsky/graph/starterpack'
import { FollowInfo } from '../proto/bsky_pb'
import { HydrationMap, ItemRef, RecordInfo, parseRecord } from './util'

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

export type StarterPack = RecordInfo<StarterPackRecord>
export type StarterPacks = HydrationMap<StarterPack>

export type StarterPackAgg = {
  joinedWeek: number
  joinedAllTime: number
  listItemSampleUris?: string[] // gets set during starter pack hydration (not for basic view)
}

export type StarterPackAggs = HydrationMap<StarterPackAgg>

export type ListAgg = {
  listItems: number
}

export type ListAggs = HydrationMap<ListAgg>

export type RelationshipPair = [didA: string, didB: string]

const dedupePairs = (pairs: RelationshipPair[]): RelationshipPair[] => {
  const deduped = pairs.reduce((acc, pair) => {
    return acc.set(Blocks.key(...pair), pair)
  }, new Map<string, RelationshipPair>())
  return [...deduped.values()]
}

export class Blocks {
  _blocks: Map<string, BlockEntry> = new Map() // did:a,did:b -> block
  constructor() {}

  static key(didA: string, didB: string): string {
    return [didA, didB].sort().join(',')
  }

  set(didA: string, didB: string, block: BlockEntry): Blocks {
    const key = Blocks.key(didA, didB)
    this._blocks.set(key, block)
    return this
  }

  get(didA: string, didB: string): BlockEntry | null {
    if (didA === didB) return null // ignore self-blocks
    const key = Blocks.key(didA, didB)
    return this._blocks.get(key) ?? null
  }

  merge(blocks: Blocks): Blocks {
    blocks._blocks.forEach((block, key) => {
      this._blocks.set(key, block)
    })
    return this
  }
}

// No "blocking" vs. "blocked" directionality: only suitable for bidirectional block checks
export type BlockEntry = {
  blockUri: string | undefined
  blockListUri: string | undefined
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
      const block = res.blocks[i]
      blocks.set(pair.a, pair.b, {
        blockUri: block.blockedBy || block.blocking || undefined,
        blockListUri: block.blockedByList || block.blockingByList || undefined,
      })
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

  async getBlocks(
    uris: string[],
    includeTakedowns = false,
  ): Promise<HydrationMap<Block>> {
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

  async getStarterPacks(
    uris: string[],
    includeTakedowns = false,
  ): Promise<StarterPacks> {
    if (!uris.length) return new HydrationMap<StarterPack>()
    const res = await this.dataplane.getStarterPackRecords({ uris })
    return uris.reduce((acc, uri, i) => {
      const record = parseRecord<StarterPackRecord>(
        res.records[i],
        includeTakedowns,
      )
      return acc.set(uri, record ?? null)
    }, new HydrationMap<StarterPack>())
  }

  async getStarterPackAggregates(refs: ItemRef[]) {
    if (!refs.length) return new HydrationMap<StarterPackAgg>()
    const counts = await this.dataplane.getStarterPackCounts({ refs })
    return refs.reduce((acc, { uri }, i) => {
      return acc.set(uri, {
        joinedWeek: counts.joinedWeek[i] ?? 0,
        joinedAllTime: counts.joinedAllTime[i] ?? 0,
      })
    }, new HydrationMap<StarterPackAgg>())
  }

  async getListAggregates(refs: ItemRef[]) {
    if (!refs.length) return new HydrationMap<ListAgg>()
    const counts = await this.dataplane.getListCounts({ refs })
    return refs.reduce((acc, { uri }, i) => {
      return acc.set(uri, {
        listItems: counts.listItems[i] ?? 0,
      })
    }, new HydrationMap<ListAgg>())
  }
}
