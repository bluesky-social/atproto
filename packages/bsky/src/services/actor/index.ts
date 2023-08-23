import { sql } from 'kysely'
import { Database } from '../../db'
import { DbRef, notSoftDeletedClause } from '../../db/util'
import { ActorViews } from './views'
import { ImageUriBuilder } from '../../image/uri'
import { Actor } from '../../db/tables/actor'
import { TimeCidKeyset } from '../../db/pagination'
import { LabelCache } from '../../label-cache'

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

  searchQb(searchField: 'did' | 'handle' = 'handle', term?: string) {
    const { ref } = this.db.db.dynamic
    let builder = this.db.db.selectFrom('actor')

    // When searchField === 'did', the term will always be a valid string because
    // searchField is set to 'did' after checking that the term is a valid did
    if (searchField === 'did' && term) {
      return builder.where('actor.did', '=', term)
    }

    if (term) {
      builder = builder.where((qb) => {
        // Performing matching by word using "strict word similarity" operator.
        // The more characters the user gives us, the more we can ratchet down
        // the distance threshold for matching.
        const threshold = term.length < 3 ? 0.9 : 0.8
        return qb
          .where(distance(term, ref('handle')), '<', threshold)
          .orWhereExists((q) =>
            q
              .selectFrom('profile')
              .whereRef('profile.creator', '=', 'actor.did')
              .where(distance(term, ref('displayName')), '<', threshold),
          )
      })
    }
    return builder
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

// Uses pg_trgm strict word similarity to check similarity between a search term and a stored value
const distance = (term: string, ref: DbRef) =>
  sql<number>`(${term} <<<-> ${ref})`

export class ListKeyset extends TimeCidKeyset<{
  indexedAt: string
  did: string // handles are treated identically to cids in TimeCidKeyset
}> {
  labelResult(result: { indexedAt: string; did: string }) {
    return { primary: result.indexedAt, secondary: result.did }
  }
}
