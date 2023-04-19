import { sql } from 'kysely'
import Database from '../../db'
import { DbRef, notSoftDeletedClause } from '../../db/util'
import { ActorViews } from './views'
import { ImageUriBuilder } from '../../image/uri'
import { Actor } from '../../db/tables/actor'
import { TimeCidKeyset } from '../../db/pagination'

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
      const orderA = order[a.did] ?? order[a.handle.toLowerCase()]
      const orderB = order[b.did] ?? order[b.handle.toLowerCase()]
      return orderA - orderB
    })
  }

  searchQb(term?: string) {
    const { ref } = this.db.db.dynamic
    let builder = this.db.db.selectFrom('actor')
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
}

type ActorResult = Actor

// Uses pg_trgm strict word similarity to check similarity between a search term and a stored value
const distance = (term: string, ref: DbRef) =>
  sql<number>`(${term} <<<-> ${ref})`

export class ListKeyset extends TimeCidKeyset<{
  indexedAt: string
  handle: string // handles are treated identically to cids in TimeCidKeyset
}> {
  labelResult(result: { indexedAt: string; handle: string }) {
    return { primary: result.indexedAt, secondary: result.handle }
  }
}
