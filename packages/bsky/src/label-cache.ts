import { Database } from './db'
import { Cache, CacheOptions } from './cache'
import { Label } from './lexicon/types/com/atproto/label/defs'

export class LabelCache extends Cache<Label[]> {
  constructor(public db: Database, opts: CacheOptions) {
    super(opts)
  }

  async fetchImpl(key: string): Promise<Label[] | null> {
    const res = await this.fetchManyImpl([key])
    return res[key]
  }

  async fetchManyImpl(subjects: string[]): Promise<Record<string, Label[]>> {
    if (subjects.length < 0) {
      return {}
    }
    const res = await this.db.db
      .selectFrom('label')
      .where('label.uri', 'in', subjects)
      .selectAll()
      .execute()
    return res.reduce((acc, cur) => {
      acc[cur.uri] ??= []
      acc[cur.uri].push({
        ...cur,
        cid: cur.cid === '' ? undefined : cur.cid,
        neg: cur.neg,
      })
      return acc
    }, {} as Record<string, Label[]>)
  }
}
