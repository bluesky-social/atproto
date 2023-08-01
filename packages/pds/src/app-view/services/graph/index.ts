import Database from '../../../db'
import { DbRef } from '../../../db/util'
import { NotEmptyArray } from '@atproto/common'
import { sql } from 'kysely'
import { ImageUriBuilder } from '../../../image/uri'
import { ProfileView } from '../../../lexicon/types/app/bsky/actor/defs'
import { List } from '../../db/tables/list'

export class GraphService {
  constructor(public db: Database, public imgUriBuilder: ImageUriBuilder) {}

  static creator(imgUriBuilder: ImageUriBuilder) {
    return (db: Database) => new GraphService(db, imgUriBuilder)
  }

  getListsQb(requester: string | null) {
    const { ref } = this.db.db.dynamic
    return this.db.db
      .selectFrom('list')
      .innerJoin('did_handle', 'did_handle.did', 'list.creator')
      .selectAll('list')
      .selectAll('did_handle')
      .select(
        this.db.db
          .selectFrom('list_mute')
          .where('list_mute.mutedByDid', '=', requester ?? '')
          .whereRef('list_mute.listUri', '=', ref('list.uri'))
          .select('list_mute.listUri')
          .as('viewerMuted'),
      )
  }

  getListItemsQb() {
    return this.db.db
      .selectFrom('list_item')
      .innerJoin('did_handle as subject', 'subject.did', 'list_item.subjectDid')
      .selectAll('subject')
      .select(['list_item.cid as cid', 'list_item.createdAt as createdAt'])
  }

  blockQb(requester: string, refs: NotEmptyArray<DbRef>) {
    const subjectRefs = sql.join(refs)
    return this.db.db
      .selectFrom('actor_block')
      .where((outer) =>
        outer
          .where((qb) =>
            qb
              .where('actor_block.creator', '=', requester)
              .whereRef('actor_block.subjectDid', 'in', sql`(${subjectRefs})`),
          )
          .orWhere((qb) =>
            qb
              .where('actor_block.subjectDid', '=', requester)
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
        .selectFrom('did_handle')
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
        ? this.imgUriBuilder.getCommonSignedUri('avatar', list.avatarCid)
        : undefined,
      indexedAt: list.indexedAt,
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
        ? this.imgUriBuilder.getCommonSignedUri('avatar', list.avatarCid)
        : undefined,
      indexedAt: list.indexedAt,
      viewer: {
        muted: !!list.viewerMuted,
      },
    }
  }
}

type ListInfo = List & {
  viewerMuted: string | null
}
