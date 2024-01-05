import { sql } from 'kysely'
import { wait } from '@atproto/common'
import { Database } from '../../db'
import { notSoftDeletedClause } from '../../db/util'
import { ActorViews } from './views'
import { ImageUriBuilder } from '../../image/uri'
import { Actor } from '../../db/tables/actor'
import { TimeCidKeyset, paginate } from '../../db/pagination'
import { SearchKeyset, getUserSearchQuery } from '../util/search'
import { FromDb } from '../types'
import { GraphService } from '../graph'
import { LabelService } from '../label'
import { AtUri } from '@atproto/syntax'
import { ids } from '../../lexicon/lexicons'

export * from './types'

export class ActorService {
  views: ActorViews

  constructor(
    public db: Database,
    public imgUriBuilder: ImageUriBuilder,
    private graph: FromDb<GraphService>,
    private label: FromDb<LabelService>,
  ) {
    this.views = new ActorViews(this.db, this.imgUriBuilder, graph, label)
  }

  static creator(
    imgUriBuilder: ImageUriBuilder,
    graph: FromDb<GraphService>,
    label: FromDb<LabelService>,
  ) {
    return (db: Database) => new ActorService(db, imgUriBuilder, graph, label)
  }

  async getActorDid(handleOrDid: string): Promise<string | null> {
    if (handleOrDid.startsWith('did:')) {
      return handleOrDid
    }
    const subject = await this.getActor(handleOrDid, true)
    return subject?.did ?? null
  }

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
      .selectFrom('actor')
      .if(!includeSoftDeleted, (qb) =>
        qb.where(notSoftDeletedClause(ref('actor'))),
      )
      .where((qb) => {
        if (dids.length) {
          qb = qb.orWhere('actor.did', 'in', dids)
        }
        if (handles.length) {
          qb = qb.orWhere(
            'actor.handle',
            'in',
            handles.length === 1
              ? [handles[0], handles[0]] // a silly (but worthwhile) optimization to avoid usage of actor_handle_tgrm_idx
              : handles,
          )
        }
        return qb
      })
      .selectAll()
      .execute()

    return results.sort((a, b) => {
      const orderA = order[a.did] ?? order[a.handle?.toLowerCase() ?? '']
      const orderB = order[b.did] ?? order[b.handle?.toLowerCase() ?? '']
      return orderA - orderB
    })
  }

  async getProfileRecords(dids: string[], includeSoftDeleted = false) {
    if (dids.length === 0) return new Map()
    const profileUris = dids.map((did) =>
      AtUri.make(did, ids.AppBskyActorProfile, 'self').toString(),
    )
    const { ref } = this.db.db.dynamic
    const res = await this.db.db
      .selectFrom('record')
      .innerJoin('actor', 'actor.did', 'record.did')
      .if(!includeSoftDeleted, (qb) =>
        qb.where(notSoftDeletedClause(ref('actor'))),
      )
      .where('uri', 'in', profileUris)
      .select(['record.did', 'record.json'])
      .execute()
    return res.reduce((acc, cur) => {
      return acc.set(cur.did, JSON.parse(cur.json))
    }, new Map<string, JSON>())
  }

  async getSearchResults({
    cursor,
    limit = 25,
    query = '',
    includeSoftDeleted,
  }: {
    cursor?: string
    limit?: number
    query?: string
    includeSoftDeleted?: boolean
  }) {
    const searchField = query.startsWith('did:') ? 'did' : 'handle'
    let paginatedBuilder
    const { ref } = this.db.db.dynamic
    const paginationOptions = {
      limit,
      cursor,
      direction: 'asc' as const,
    }
    let keyset

    if (query && searchField === 'handle') {
      keyset = new SearchKeyset(sql``, sql``)
      paginatedBuilder = getUserSearchQuery(this.db, {
        query,
        includeSoftDeleted,
        ...paginationOptions,
      }).select('distance')
    } else {
      paginatedBuilder = this.db.db
        .selectFrom('actor')
        .select([sql<number>`0`.as('distance')])
      keyset = new ListKeyset(ref('indexedAt'), ref('did'))

      // When searchField === 'did', the query will always be a valid string because
      // searchField is set to 'did' after checking that the query is a valid did
      if (query && searchField === 'did') {
        paginatedBuilder = paginatedBuilder.where('actor.did', '=', query)
      }
      paginatedBuilder = paginate(paginatedBuilder, {
        keyset,
        ...paginationOptions,
      })
    }

    const results: Actor[] = await paginatedBuilder.selectAll('actor').execute()
    return { results, cursor: keyset.packFromResult(results) }
  }

  async getRepoRev(did: string | null): Promise<string | null> {
    if (did === null) return null
    const res = await this.db.db
      .selectFrom('actor_sync')
      .select('repoRev')
      .where('did', '=', did)
      .executeTakeFirst()
    return res?.repoRev ?? null
  }

  async *all(
    opts: {
      batchSize?: number
      forever?: boolean
      cooldownMs?: number
      startFromDid?: string
    } = {},
  ) {
    const {
      cooldownMs = 1000,
      batchSize = 1000,
      forever = false,
      startFromDid,
    } = opts
    const baseQuery = this.db.db
      .selectFrom('actor')
      .selectAll()
      .orderBy('did')
      .limit(batchSize)
    while (true) {
      let cursor = startFromDid
      do {
        const actors = cursor
          ? await baseQuery.where('did', '>', cursor).execute()
          : await baseQuery.execute()
        for (const actor of actors) {
          yield actor
        }
        cursor = actors.at(-1)?.did
      } while (cursor)
      if (forever) {
        await wait(cooldownMs)
      } else {
        return
      }
    }
  }
}

type ActorResult = Actor
export class ListKeyset extends TimeCidKeyset<{
  indexedAt: string
  did: string // handles are treated identically to cids in TimeCidKeyset
}> {
  labelResult(result: { indexedAt: string; did: string }) {
    return { primary: result.indexedAt, secondary: result.did }
  }
}
