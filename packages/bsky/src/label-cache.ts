import { PrimaryDatabase } from './db'
import { Cache } from './cache'
import { Redis } from 'ioredis'
import { Label } from './lexicon/types/com/atproto/label/defs'

export class LabelCache extends Cache<Label[]> {
  constructor(
    public db: PrimaryDatabase,
    public redis: Redis,
    public staleTTL: number,
    public maxTTL: number,
  ) {
    super(redis, staleTTL, maxTTL)
  }

  async fetchMany(subjects: string[]): Promise<Record<string, Label[]>> {
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
