import Database from '../../../db'
import { DidHandle } from '../../../db/tables/did-handle'
import { DbRef, notSoftDeletedClause } from '../../../db/util'
import { ActorViews } from './views'
import { ImageUriBuilder } from '../../../image/uri'
import { NotEmptyArray } from '@atproto/common'
import { sql } from 'kysely'

export class ActorService {
  constructor(public db: Database, public imgUriBuilder: ImageUriBuilder) {}

  static creator(imgUriBuilder: ImageUriBuilder) {
    return (db: Database) => new ActorService(db, imgUriBuilder)
  }

  views = new ActorViews(this.db, this.imgUriBuilder)

  async getActor(
    handleOrDid: string,
    includeSoftDeleted = false,
  ): Promise<ActorResult | null> {
    const actors = await this.getActors([handleOrDid], includeSoftDeleted)
    return actors[0] || null
  }

  async getActors(
    handleOrDids: string[],
    includeSoftDeleted = false,
  ): Promise<ActorResult[]> {
    const { ref } = this.db.db.dynamic
    const dids: string[] = []
    const handles: string[] = []
    const order: Record<string, number> = {}
    handleOrDids.forEach((item, i) => {
      if (item.startsWith('did:')) {
        order[item] = i
        dids.push(item)
      } else {
        order[item.toLowerCase()] = i
        handles.push(item.toLowerCase())
      }
    })
    const results = await this.db.db
      .selectFrom('did_handle')
      .innerJoin('repo_root', 'repo_root.did', 'did_handle.did')
      .if(!includeSoftDeleted, (qb) =>
        qb.where(notSoftDeletedClause(ref('repo_root'))),
      )
      .where((qb) => {
        if (dids.length) {
          qb = qb.orWhere('did_handle.did', 'in', dids)
        }
        if (handles.length) {
          qb = qb.orWhere('did_handle.handle', 'in', handles)
        }
        return qb
      })
      .selectAll('did_handle')
      .select('takedownId')
      .execute()

    return results.sort((a, b) => {
      const orderA = order[a.did] ?? order[a.handle.toLowerCase()]
      const orderB = order[b.did] ?? order[b.handle.toLowerCase()]
      return orderA - orderB
    })
  }

  blockQb(requester: string, refs: NotEmptyArray<DbRef>) {
    return this.actorBlockQb(requester, refs).union(
      this.blockListQb(requester, refs),
    )
  }

  actorBlockQb(requester: string, refs: NotEmptyArray<DbRef>) {
    const subjectRefs = sql.join(refs)
    return this.db.db
      .selectFrom('actor_block')
      .where((qb) =>
        qb
          .where('actor_block.creator', '=', requester)
          .whereRef('actor_block.subjectDid', 'in', sql`(${subjectRefs})`),
      )
      .orWhere((qb) =>
        qb
          .where('actor_block.subjectDid', '=', requester)
          .whereRef('actor_block.creator', 'in', sql`(${subjectRefs})`),
      )
      .select(['creator', 'subjectDid'])
  }

  blockListQb(requester: string, refs: NotEmptyArray<DbRef>) {
    const subjectRefs = sql.join(refs)

    return this.db.db
      .selectFrom('list_block')
      .innerJoin('list', 'list.uri', 'list_block.subjectUri')
      .innerJoin('list_item', (join) =>
        join
          .onRef('list_item.creator', '=', 'list.creator')
          .onRef('list_item.listUri', '=', 'list.uri'),
      )
      .where((qb) =>
        qb
          .where('list_block.creator', '=', requester)
          .whereRef('list_item.subjectDid', 'in', sql`(${subjectRefs})`),
      )
      .orWhere((qb) =>
        qb
          .where('list_item.subjectDid', '=', requester)
          .whereRef('list_block.creator', 'in', sql`(${subjectRefs})`),
      )
      .select([
        'list_block.creator as creator',
        'list_item.subjectDid as subjectDid',
      ])
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
    const actorBlockReq = this.db.db
      .selectFrom('actor_block')
      .where('creator', 'in', accnts)
      .where('subjectDid', 'in', accnts)
      .selectAll()

    const listBlockReq = this.db.db
      .selectFrom('list_block')
      .innerJoin('list', 'list.uri', 'list_block.subjectUri')
      .innerJoin('list_item', (join) =>
        join
          .onRef('list_item.creator', '=', 'list.creator')
          .onRef('list_item.listUri', '=', 'list.uri'),
      )
      .where('list_block.creator', 'in', accnts)
      .where('list_item.subjectDid', 'in', accnts)
      .select([
        'list_block.creator as creator',
        'list_item.subjectDid as subjectDid',
      ])

    const [actorBlockRes, listBlockRes] = await Promise.all([
      actorBlockReq.execute(),
      listBlockReq.execute(),
    ])

    const blocking =
      actorBlockRes.some(
        (row) => row.creator === requester && row.subjectDid === subjectDid,
      ) ||
      listBlockRes.some(
        (row) => row.creator === requester && row.subjectDid === subjectDid,
      )
    const blockedBy =
      actorBlockRes.some(
        (row) => row.creator === subjectDid && row.subjectDid === requester,
      ) ||
      listBlockRes.some(
        (row) => row.creator === subjectDid && row.subjectDid === requester,
      )

    return {
      blocking,
      blockedBy,
    }
  }
}

type ActorResult = DidHandle & { takedownId: number | null }
