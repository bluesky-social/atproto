import AtpAgent from '@atproto/api'
import { PrimaryDatabase } from '../db'
import { sql } from 'kysely'
import { dbLogger } from '../logger'
import { SECOND } from '@atproto/common'

export class LabelSubscription {
  destroyed = false
  promise: Promise<void> = Promise.resolve()
  timer: NodeJS.Timer | undefined
  lastLabel: number | undefined
  labelAgent: AtpAgent

  constructor(public db: PrimaryDatabase, public labelProvider: string) {
    this.labelAgent = new AtpAgent({ service: labelProvider })
  }

  async start() {
    const res = await this.db.db
      .selectFrom('label')
      .select('cts')
      .orderBy('cts', 'desc')
      .limit(1)
      .executeTakeFirst()
    this.lastLabel = res ? new Date(res.cts).getTime() : undefined
    this.poll()
  }

  poll() {
    if (this.destroyed) return
    this.promise = this.fetchLabels()
      .catch((err) =>
        dbLogger.error({ err }, 'failed to fetch and store labels'),
      )
      .finally(() => {
        this.timer = setTimeout(() => this.poll(), SECOND)
      })
  }

  async fetchLabels() {
    const res = await this.labelAgent.api.com.atproto.temp.fetchLabels({
      since: this.lastLabel,
    })
    const last = res.data.labels.at(-1)
    if (!last) {
      return
    }
    const dbVals = res.data.labels.map((l) => ({
      ...l,
      cid: l.cid ?? '',
      neg: l.neg ?? false,
    }))
    const { ref } = this.db.db.dynamic
    const excluded = (col: string) => ref(`excluded.${col}`)
    await this.db
      .asPrimary()
      .db.insertInto('label')
      .values(dbVals)
      .onConflict((oc) =>
        oc.columns(['src', 'uri', 'cid', 'val']).doUpdateSet({
          neg: sql`${excluded('neg')}`,
          cts: sql`${excluded('cts')}`,
        }),
      )
      .execute()
    this.lastLabel = new Date(last.cts).getTime()
  }

  async destroy() {
    this.destroyed = true
    if (this.timer) {
      clearTimeout(this.timer)
    }
    await this.promise
  }
}
