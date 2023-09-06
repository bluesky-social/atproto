import { sql } from 'kysely'
import { Database } from '../../db'
import { ImageUriBuilder } from '../../image/uri'
import { valuesList } from '../../db/util'
import { ListInfo } from './types'
import { ActorInfoMap } from '../actor'

export * from './types'

export class GraphService {
  constructor(public db: Database, public imgUriBuilder: ImageUriBuilder) {}

  static creator(imgUriBuilder: ImageUriBuilder) {
    return (db: Database) => new GraphService(db, imgUriBuilder)
  }

  async muteActor(info: {
    subjectDid: string
    mutedByDid: string
    createdAt?: Date
  }) {
    const { subjectDid, mutedByDid, createdAt = new Date() } = info
    await this.db
      .asPrimary()
      .db.insertInto('mute')
      .values({
        subjectDid,
        mutedByDid,
        createdAt: createdAt.toISOString(),
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
  }

  async unmuteActor(info: { subjectDid: string; mutedByDid: string }) {
    const { subjectDid, mutedByDid } = info
    await this.db
      .asPrimary()
      .db.deleteFrom('mute')
      .where('subjectDid', '=', subjectDid)
      .where('mutedByDid', '=', mutedByDid)
      .execute()
  }

  async muteActorList(info: {
    list: string
    mutedByDid: string
    createdAt?: Date
  }) {
    const { list, mutedByDid, createdAt = new Date() } = info
    await this.db
      .asPrimary()
      .db.insertInto('list_mute')
      .values({
        listUri: list,
        mutedByDid,
        createdAt: createdAt.toISOString(),
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
  }

  async unmuteActorList(info: { list: string; mutedByDid: string }) {
    const { list, mutedByDid } = info
    await this.db
      .asPrimary()
      .db.deleteFrom('list_mute')
      .where('listUri', '=', list)
      .where('mutedByDid', '=', mutedByDid)
      .execute()
  }

  getListsQb(viewer: string | null) {
    const { ref } = this.db.db.dynamic
    return this.db.db
      .selectFrom('list')
      .innerJoin('actor', 'actor.did', 'list.creator')
      .selectAll('list')
      .selectAll('actor')
      .select('list.sortAt as sortAt')
      .select([
        this.db.db
          .selectFrom('list_mute')
          .where('list_mute.mutedByDid', '=', viewer ?? '')
          .whereRef('list_mute.listUri', '=', ref('list.uri'))
          .select('list_mute.listUri')
          .as('viewerMuted'),
        this.db.db
          .selectFrom('list_block')
          .where('list_block.creator', '=', viewer ?? '')
          .whereRef('list_block.subjectUri', '=', ref('list.uri'))
          .select('list_block.uri')
          .as('viewerListBlockUri'),
      ])
  }

  getListItemsQb() {
    return this.db.db
      .selectFrom('list_item')
      .innerJoin('actor as subject', 'subject.did', 'list_item.subjectDid')
      .selectAll('subject')
      .select(['list_item.cid as cid', 'list_item.sortAt as sortAt'])
  }

  async getBlockAndMuteState(
    pairs: RelationshipPair[],
    bam?: BlockAndMuteState,
  ) {
    pairs = bam ? pairs.filter((pair) => !bam.has(pair)) : pairs
    const result = bam ?? new BlockAndMuteState()
    if (!pairs.length) return result
    const { ref } = this.db.db.dynamic
    const sourceRef = ref('pair.source')
    const targetRef = ref('pair.target')
    const values = valuesList(pairs.map((p) => sql`${p[0]}, ${p[1]}`))
    const items = await this.db.db
      .selectFrom(values.as(sql`pair (source, target)`))
      .select([
        sql<string>`${sourceRef}`.as('source'),
        sql<string>`${targetRef}`.as('target'),
        this.db.db
          .selectFrom('actor_block')
          .whereRef('creator', '=', sourceRef)
          .whereRef('subjectDid', '=', targetRef)
          .select('uri')
          .as('blocking'),
        this.db.db
          .selectFrom('list_item')
          .innerJoin('list_block', 'list_block.subjectUri', 'list_item.listUri')
          .whereRef('list_block.creator', '=', sourceRef)
          .whereRef('list_item.subjectDid', '=', targetRef)
          .select('list_item.listUri')
          .limit(1)
          .as('blockingViaList'),
        this.db.db
          .selectFrom('actor_block')
          .whereRef('creator', '=', targetRef)
          .whereRef('subjectDid', '=', sourceRef)
          .select('uri')
          .as('blockedBy'),
        this.db.db
          .selectFrom('list_item')
          .innerJoin('list_block', 'list_block.subjectUri', 'list_item.listUri')
          .whereRef('list_block.creator', '=', targetRef)
          .whereRef('list_item.subjectDid', '=', sourceRef)
          .select('list_item.listUri')
          .limit(1)
          .as('blockedByViaList'),
        this.db.db
          .selectFrom('mute')
          .whereRef('mutedByDid', '=', sourceRef)
          .whereRef('subjectDid', '=', targetRef)
          .select(sql<true>`${true}`.as('val'))
          .as('muting'),
        this.db.db
          .selectFrom('list_item')
          .innerJoin('list_mute', 'list_mute.listUri', 'list_item.listUri')
          .whereRef('list_mute.mutedByDid', '=', sourceRef)
          .whereRef('list_item.subjectDid', '=', targetRef)
          .select('list_item.listUri')
          .limit(1)
          .as('mutingViaList'),
      ])
      .selectAll()
      .execute()
    items.forEach((item) => result.add(item))
    return result
  }

  async getBlockState(pairs: RelationshipPair[], bam?: BlockAndMuteState) {
    pairs = bam ? pairs.filter((pair) => !bam.has(pair)) : pairs
    const result = bam ?? new BlockAndMuteState()
    if (!pairs.length) return result
    const { ref } = this.db.db.dynamic
    const sourceRef = ref('pair.source')
    const targetRef = ref('pair.target')
    const values = valuesList(pairs.map((p) => sql`${p[0]}, ${p[1]}`))
    const items = await this.db.db
      .selectFrom(values.as(sql`pair (source, target)`))
      .select([
        sql<string>`${sourceRef}`.as('source'),
        sql<string>`${targetRef}`.as('target'),
        this.db.db
          .selectFrom('actor_block')
          .whereRef('creator', '=', sourceRef)
          .whereRef('subjectDid', '=', targetRef)
          .select('uri')
          .as('blocking'),
        this.db.db
          .selectFrom('list_item')
          .innerJoin('list_block', 'list_block.subjectUri', 'list_item.listUri')
          .whereRef('list_block.creator', '=', sourceRef)
          .whereRef('list_item.subjectDid', '=', targetRef)
          .select('list_item.listUri')
          .limit(1)
          .as('blockingViaList'),
        this.db.db
          .selectFrom('actor_block')
          .whereRef('creator', '=', targetRef)
          .whereRef('subjectDid', '=', sourceRef)
          .select('uri')
          .as('blockedBy'),
        this.db.db
          .selectFrom('list_item')
          .innerJoin('list_block', 'list_block.subjectUri', 'list_item.listUri')
          .whereRef('list_block.creator', '=', targetRef)
          .whereRef('list_item.subjectDid', '=', sourceRef)
          .select('list_item.listUri')
          .limit(1)
          .as('blockedByViaList'),
      ])
      .selectAll()
      .execute()
    items.forEach((item) => result.add(item))
    return result
  }

  async getListViews(listUris: string[], requester: string | null) {
    if (listUris.length < 1) return {}
    const lists = await this.getListsQb(requester)
      .where('list.uri', 'in', listUris)
      .execute()
    return lists.reduce(
      (acc, cur) => ({
        ...acc,
        [cur.uri]: cur,
      }),
      {},
    )
  }

  formatListView(list: ListInfo, profiles: ActorInfoMap) {
    return {
      ...this.formatListViewBasic(list),
      creator: profiles[list.creator],
      description: list.description ?? undefined,
      descriptionFacets: list.descriptionFacets
        ? JSON.parse(list.descriptionFacets)
        : undefined,
    }
  }

  formatListViewBasic(list: ListInfo) {
    return {
      uri: list.uri,
      cid: list.cid,
      name: list.name,
      purpose: list.purpose,
      avatar: list.avatarCid
        ? this.imgUriBuilder.getPresetUri(
            'avatar',
            list.creator,
            list.avatarCid,
          )
        : undefined,
      indexedAt: list.sortAt,
      viewer: {
        muted: !!list.viewerMuted,
        blocked: list.viewerListBlockUri ?? undefined,
      },
    }
  }
}

export type RelationshipPair = [didA: string, didB: string]

export class BlockAndMuteState {
  hasIdx = new Map<string, Set<string>>() // did -> did
  blockIdx = new Map<string, Map<string, string>>() // did -> did -> block uri
  muteIdx = new Map<string, Set<string>>() // did -> did
  muteListIdx = new Map<string, Map<string, string>>() // did -> did -> list uri
  constructor(items: BlockAndMuteInfo[] = []) {
    items.forEach((item) => this.add(item))
  }
  add(item: BlockAndMuteInfo) {
    const blocking = item.blocking || item.blockingViaList // block or list uri
    if (blocking) {
      const map = this.blockIdx.get(item.source) ?? new Map()
      map.set(item.target, blocking)
      if (!this.blockIdx.has(item.source)) {
        this.blockIdx.set(item.source, map)
      }
    }
    const blockedBy = item.blockedBy || item.blockedByViaList // block or list uri
    if (blockedBy) {
      const map = this.blockIdx.get(item.target) ?? new Map()
      map.set(item.source, blockedBy)
      if (!this.blockIdx.has(item.target)) {
        this.blockIdx.set(item.target, map)
      }
    }
    if (item.muting) {
      const set = this.muteIdx.get(item.source) ?? new Set()
      set.add(item.target)
      if (!this.muteIdx.has(item.source)) {
        this.muteIdx.set(item.source, set)
      }
    }
    if (item.mutingViaList) {
      const map = this.muteListIdx.get(item.source) ?? new Map()
      map.set(item.target, item.mutingViaList)
      if (!this.muteListIdx.has(item.source)) {
        this.muteListIdx.set(item.source, map)
      }
    }
    const set = this.hasIdx.get(item.source) ?? new Set()
    set.add(item.target)
    if (!this.hasIdx.has(item.source)) {
      this.hasIdx.set(item.source, set)
    }
  }
  block(pair: RelationshipPair): boolean {
    return !!this.blocking(pair) || !!this.blockedBy(pair)
  }
  // block or list uri
  blocking(pair: RelationshipPair): string | null {
    return this.blockIdx.get(pair[0])?.get(pair[1]) ?? null
  }
  // block or list uri
  blockedBy(pair: RelationshipPair): string | null {
    return this.blocking([pair[1], pair[0]])
  }
  mute(pair: RelationshipPair): boolean {
    return !!this.muteIdx.get(pair[0])?.has(pair[1]) || !!this.muteList(pair)
  }
  // list uri
  muteList(pair: RelationshipPair): string | null {
    return this.muteListIdx.get(pair[0])?.get(pair[1]) ?? null
  }
  has(pair: RelationshipPair) {
    return !!this.hasIdx.get(pair[0])?.has(pair[1])
  }
}

type BlockAndMuteInfo = {
  source: string
  target: string
  blocking?: string | null
  blockingViaList?: string | null
  blockedBy?: string | null
  blockedByViaList?: string | null
  muting?: true | null
  mutingViaList?: string | null
}
