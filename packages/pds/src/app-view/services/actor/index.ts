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
    const subjectRefs = sql.join(refs)
    return this.db.db
      .selectFrom('actor_block')
      .selectAll()
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
    const res = await this.db.db
      .selectFrom('actor_block')
      .where('creator', 'in', accnts)
      .where('subjectDid', 'in', accnts)
      .selectAll()
      .execute()

    const blocking = res.some(
      (row) => row.creator === requester && row.subjectDid === subjectDid,
    )
    const blockedBy = res.some(
      (row) => row.creator === subjectDid && row.subjectDid === requester,
    )
    return {
      blocking,
      blockedBy,
    }
  }
}

type ActorResult = DidHandle & { takedownId: number | null }
