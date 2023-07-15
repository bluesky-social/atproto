import Database from '../../db'
import { ImageUriBuilder } from '../../image/uri'
import { ProfileView } from '../../lexicon/types/app/bsky/actor/defs'
import { List } from '../../db/tables/list'
import { Selectable, WhereInterface, sql } from 'kysely'
import { NotEmptyArray } from '@atproto/common'
import { DbRef, noMatch } from '../../db/util'

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
    await this.db.db
      .insertInto('mute')
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
    await this.db.db
      .deleteFrom('mute')
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
    await this.db.db
      .insertInto('list_mute')
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
    await this.db.db
      .deleteFrom('list_mute')
      .where('listUri', '=', list)
      .where('mutedByDid', '=', mutedByDid)
      .execute()
  }

  whereNotMuted<W extends WhereInterface<any, any>>(
    qb: W,
    requester: string,
    refs: NotEmptyArray<DbRef>,
  ) {
    const subjectRefs = sql.join(refs)
    const actorMute = this.db.db
      .selectFrom('mute')
      .where('mutedByDid', '=', requester)
      .where('subjectDid', 'in', sql`(${subjectRefs})`)
      .select('subjectDid as muted')
    const listMute = this.db.db
      .selectFrom('list_item')
      .innerJoin('list_mute', 'list_mute.listUri', 'list_item.listUri')
      .where('list_mute.mutedByDid', '=', requester)
      .whereRef('list_item.subjectDid', 'in', sql`(${subjectRefs})`)
      .select('list_item.subjectDid as muted')
    // Splitting the mute from list-mute checks seems to be more flexible for the query-planner and often quicker
    return qb.whereNotExists(actorMute).whereNotExists(listMute)
  }

  getListsQb(viewer: string | null) {
    const { ref } = this.db.db.dynamic
    return this.db.db
      .selectFrom('list')
      .innerJoin('actor', 'actor.did', 'list.creator')
      .selectAll('list')
      .selectAll('actor')
      .select('list.sortAt as sortAt')
      .select(
        this.db.db
          .selectFrom('list_mute')
          .where('list_mute.mutedByDid', '=', viewer ?? '')
          .whereRef('list_mute.listUri', '=', ref('list.uri'))
          .select('list_mute.listUri')
          .as('viewerMuted'),
      )
  }

  getListItemsQb() {
    return this.db.db
      .selectFrom('list_item')
      .innerJoin('actor as subject', 'subject.did', 'list_item.subjectDid')
      .selectAll('subject')
      .select(['list_item.cid as cid', 'list_item.sortAt as sortAt'])
  }

  blockQb(viewer: string | null, refs: NotEmptyArray<DbRef>) {
    const subjectRefs = sql.join(refs)
    return this.db.db
      .selectFrom('actor_block')
      .if(!viewer, (q) => q.where(noMatch))
      .where((outer) =>
        outer
          .where((qb) =>
            qb
              .where('actor_block.creator', '=', viewer ?? '')
              .whereRef('actor_block.subjectDid', 'in', sql`(${subjectRefs})`),
          )
          .orWhere((qb) =>
            qb
              .where('actor_block.subjectDid', '=', viewer ?? '')
              .whereRef('actor_block.creator', 'in', sql`(${subjectRefs})`),
          ),
      )
      .select(['creator', 'subjectDid'])
  }

  async getBlocks(
    requester: string,
    subjectHandleOrDid: string,
  ): Promise<{ blocking: boolean; blockedBy: boolean }> {
    let subjectDid
    if (subjectHandleOrDid.startsWith('did:')) {
      subjectDid = subjectHandleOrDid
    } else {
      const res = await this.db.db
        .selectFrom('actor')
        .where('handle', '=', subjectHandleOrDid)
        .select('did')
        .executeTakeFirst()
      if (!res) {
        return { blocking: false, blockedBy: false }
      }
      subjectDid = res.did
    }

    const accnts = [requester, subjectDid]
    const blockRes = await this.db.db
      .selectFrom('actor_block')
      .where('creator', 'in', accnts)
      .where('subjectDid', 'in', accnts)
      .selectAll()
      .execute()

    const blocking = blockRes.some(
      (row) => row.creator === requester && row.subjectDid === subjectDid,
    )
    const blockedBy = blockRes.some(
      (row) => row.creator === subjectDid && row.subjectDid === requester,
    )

    return {
      blocking,
      blockedBy,
    }
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

  formatListView(list: ListInfo, profiles: Record<string, ProfileView>) {
    return {
      uri: list.uri,
      cid: list.cid,
      creator: profiles[list.creator],
      name: list.name,
      purpose: list.purpose,
      description: list.description ?? undefined,
      descriptionFacets: list.descriptionFacets
        ? JSON.parse(list.descriptionFacets)
        : undefined,
      avatar: list.avatarCid
        ? this.imgUriBuilder.getCommonSignedUri(
            'avatar',
            list.creator,
            list.avatarCid,
          )
        : undefined,
      indexedAt: list.sortAt,
      viewer: {
        muted: !!list.viewerMuted,
      },
    }
  }

  formatListViewBasic(list: ListInfo) {
    return {
      uri: list.uri,
      cid: list.cid,
      name: list.name,
      purpose: list.purpose,
      avatar: list.avatarCid
        ? this.imgUriBuilder.getCommonSignedUri(
            'avatar',
            list.creator,
            list.avatarCid,
          )
        : undefined,
      indexedAt: list.indexedAt,
      viewer: {
        muted: !!list.viewerMuted,
      },
    }
  }
}

type ListInfo = Selectable<List> & {
  viewerMuted: string | null
}
