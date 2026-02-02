import { AtUriString, DidString } from '@atproto/syntax'
import { DataPlaneClient } from '../data-plane/client'
import { FollowInfo } from '../proto/bsky_pb'
import {
  BlockRecord,
  FollowRecord,
  ListItemRecord,
  ListRecord,
  StarterPackRecord,
  VerificationRecord,
} from '../views/types.js'
import { HydrationMap, ItemRef, RecordInfo, parseRecord } from './util'

export type List = RecordInfo<ListRecord>
export type Lists = HydrationMap<List, AtUriString>

export type ListItem = RecordInfo<ListItemRecord>
export type ListItems = HydrationMap<ListItem, AtUriString>

export type ListViewerState = {
  viewerMuted?: string // @TODO AtUriString ?
  viewerListBlockUri?: AtUriString
  viewerInList?: string // @TODO AtUriString ?
}

export type ListViewerStates = HydrationMap<ListViewerState, AtUriString>

export type ListMembershipState = {
  actorListItemUri?: AtUriString
}

// list uri => actor did => state
export type ListMembershipStates = HydrationMap<
  HydrationMap<ListMembershipState, DidString>,
  AtUriString
>

export type Follow = RecordInfo<FollowRecord>
export type Follows = HydrationMap<Follow, AtUriString>

export type Block = RecordInfo<BlockRecord>

export type StarterPack = RecordInfo<StarterPackRecord>
export type StarterPacks = HydrationMap<StarterPack, AtUriString>

export type Verification = RecordInfo<VerificationRecord>
export type Verifications = HydrationMap<Verification, AtUriString>

export type StarterPackAgg = {
  joinedWeek: number
  joinedAllTime: number
  listItemSampleUris?: AtUriString[] // gets set during starter pack hydration (not for basic view)
}

export type StarterPackAggs = HydrationMap<StarterPackAgg, AtUriString>

export type ListAgg = {
  listItems: number
}

export type ListAggs = HydrationMap<ListAgg, AtUriString>

export type RelationshipPair = [didA: DidString, didB: DidString]

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
  blockUri: AtUriString | undefined
  blockListUri: AtUriString | undefined
}

export class GraphHydrator {
  constructor(public dataplane: DataPlaneClient) {}

  async getLists(
    uris: AtUriString[],
    includeTakedowns = false,
  ): Promise<Lists> {
    const map: Lists = new HydrationMap()
    if (uris.length) {
      const res = await this.dataplane.getListRecords({ uris })
      for (let i = 0; i < uris.length; i++) {
        const record = parseRecord<ListRecord>(res.records[i], includeTakedowns)
        map.set(uris[i], record ?? null)
      }
    }
    return map
  }

  async getListItems(
    uris: AtUriString[],
    includeTakedowns = false,
  ): Promise<ListItems> {
    const map: ListItems = new HydrationMap()

    if (uris.length) {
      const res = await this.dataplane.getListItemRecords({ uris })
      for (let i = 0; i < uris.length; i++) {
        const record = parseRecord<ListItemRecord>(
          res.records[i],
          includeTakedowns,
        )
        map.set(uris[i], record ?? null)
      }
    }

    return map
  }

  async getListViewerStates(
    uris: AtUriString[],
    viewer: string,
  ): Promise<ListViewerStates> {
    const map: ListViewerStates = new HydrationMap()

    if (uris.length) {
      const mutesAndBlocks = await Promise.all(
        uris.map((uri) => this.getMutesAndBlocks(uri, viewer)),
      )
      const listMemberships = await this.dataplane.getListMembership({
        actorDid: viewer,
        listUris: uris,
      })
      for (let i = 0; i < uris.length; i++) {
        const uri = uris[i]
        map.set(uri, {
          viewerMuted: mutesAndBlocks[i].muted ? uri : undefined,
          viewerListBlockUri: mutesAndBlocks[i].listBlockUri || undefined,
          viewerInList: listMemberships.listitemUris[i],
        })
      }
    }

    return map
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
      listBlockUri: listBlockUri.listblockUri as AtUriString,
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
        blockUri: (block.blockedBy || block.blocking || undefined) as
          | AtUriString
          | undefined,
        blockListUri: (block.blockedByList ||
          block.blockingByList ||
          undefined) as AtUriString | undefined,
      })
    }
    return blocks
  }

  async getFollows(
    uris: AtUriString[],
    includeTakedowns = false,
  ): Promise<Follows> {
    const map: Follows = new HydrationMap()
    if (uris.length) {
      const res = await this.dataplane.getFollowRecords({ uris })
      for (let i = 0; i < uris.length; i++) {
        const uri = uris[i]
        const record = parseRecord<FollowRecord>(
          res.records[i],
          includeTakedowns,
        )
        map.set(uri, record ?? null)
      }
    }
    return map
  }

  async getVerifications(
    uris: AtUriString[],
    includeTakedowns = false,
  ): Promise<Verifications> {
    const map: Verifications = new HydrationMap()
    if (uris.length) {
      const res = await this.dataplane.getVerificationRecords({ uris })
      for (let i = 0; i < uris.length; i++) {
        const uri = uris[i]
        const record = parseRecord<VerificationRecord>(
          res.records[i],
          includeTakedowns,
        )
        map.set(uri, record ?? null)
      }
    }
    return map
  }

  async getBlocks(
    uris: AtUriString[],
    includeTakedowns = false,
  ): Promise<HydrationMap<Block, AtUriString>> {
    const map = new HydrationMap<Block, AtUriString>()

    if (uris.length) {
      const res = await this.dataplane.getBlockRecords({ uris })
      for (let i = 0; i < uris.length; i++) {
        const uri = uris[i]
        const record = parseRecord<BlockRecord>(
          res.records[i],
          includeTakedowns,
        )
        map.set(uri, record ?? null)
      }
    }

    return map
  }

  async getActorFollows(input: {
    did: DidString
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
    did: DidString
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
    uris: AtUriString[],
    includeTakedowns = false,
  ): Promise<StarterPacks> {
    const map: StarterPacks = new HydrationMap()

    if (uris.length) {
      const res = await this.dataplane.getStarterPackRecords({ uris })
      for (let i = 0; i < uris.length; i++) {
        const uri = uris[i]
        const record = parseRecord<StarterPackRecord>(
          res.records[i],
          includeTakedowns,
        )
        map.set(uri, record ?? null)
      }
    }

    return map
  }

  async getStarterPackAggregates(refs: ItemRef[]) {
    const map: StarterPackAggs = new HydrationMap()

    if (refs.length) {
      const counts = await this.dataplane.getStarterPackCounts({ refs })
      for (let i = 0; i < refs.length; i++) {
        map.set(refs[i].uri, {
          joinedWeek: counts.joinedWeek[i] ?? 0,
          joinedAllTime: counts.joinedAllTime[i] ?? 0,
        })
      }
    }

    return map
  }

  async getListAggregates(refs: ItemRef[]): Promise<ListAggs> {
    const map: ListAggs = new HydrationMap()

    if (refs.length) {
      const counts = await this.dataplane.getListCounts({ refs })
      for (let i = 0; i < refs.length; i++) {
        map.set(refs[i].uri, {
          listItems: counts.listItems[i] ?? 0,
        })
      }
    }
    return map
  }
}
