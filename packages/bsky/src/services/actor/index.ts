import Database from '../../db'
import { notSoftDeletedClause } from '../../db/util'
import { ActorViews } from './views'
import { ImageUriBuilder } from '../../image/uri'
import { Actor } from '../../db/tables/actor'

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
}

type ActorResult = Actor
