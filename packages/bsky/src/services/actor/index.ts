import { sql } from 'kysely'
import { Database } from '../../db'
import { notSoftDeletedClause } from '../../db/util'
import { ActorViews } from './views'
import { ImageUriBuilder } from '../../image/uri'
import { Actor } from '../../db/tables/actor'
import { LabelCache } from '../../label-cache'
import { TimeCidKeyset, paginate } from '../../db/pagination'
import { SearchKeyset, getUserSearchQuery } from '../util/search'

export * from './types'

export class ActorService {
  constructor(
    public db: Database,
    public imgUriBuilder: ImageUriBuilder,
    public labelCache: LabelCache,
  ) {}

  static creator(imgUriBuilder: ImageUriBuilder, labelCache: LabelCache) {
    return (db: Database) => new ActorService(db, imgUriBuilder, labelCache)
  }

  views = new ActorViews(this.db, this.imgUriBuilder, this.labelCache)

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
          qb = qb.orWhere('actor.handle', 'in', handles)
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

  async getSearchResults({
    cursor,
    limit = 25,
    term = '',
    includeSoftDeleted,
  }: {
    cursor?: string
    limit?: number
    term?: string
    includeSoftDeleted?: boolean
  }) {
    const searchField = term.startsWith('did:') ? 'did' : 'handle'
    let paginatedBuilder
    const { ref } = this.db.db.dynamic
    const paginationOptions = {
      limit,
      cursor,
      direction: 'asc' as const,
    }
    let keyset

    if (term && searchField === 'handle') {
      keyset = new SearchKeyset(sql``, sql``)
      paginatedBuilder = getUserSearchQuery(this.db, {
        term,
        includeSoftDeleted,
        ...paginationOptions,
      }).select('distance')
    } else {
      paginatedBuilder = this.db.db
        .selectFrom('actor')
        .select([sql<number>`0`.as('distance')])
      keyset = new ListKeyset(ref('indexedAt'), ref('did'))

      // When searchField === 'did', the term will always be a valid string because
      // searchField is set to 'did' after checking that the term is a valid did
      if (term && searchField === 'did') {
        paginatedBuilder = paginatedBuilder.where('actor.did', '=', term)
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
