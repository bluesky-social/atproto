import Database from '../../../db'
import { DidHandle } from '../../../db/tables/did-handle'
import { notSoftDeletedClause } from '../../../db/util'
import { ActorViews } from './views'
import { ImageUriBuilder } from '../../../image/uri'
import { LabelCache } from '../../../label-cache'

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
}

type ActorResult = DidHandle & { takedownId: number | null }
