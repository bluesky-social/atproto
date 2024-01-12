import EventEmitter from 'events'
import TypedEmitter from 'typed-emitter'
import { seqLogger as log } from '../logger'
import { SECOND, wait } from '@atproto/common'
import Database from '../db'
import { Labels as LabelsEvt } from '../lexicon/types/com/atproto/label/subscribeLabels'
import { Label as LabelTable } from '../db/schema/label'
import { Selectable } from 'kysely'

type LabelRow = Selectable<LabelTable>

export class Sequencer extends (EventEmitter as new () => SequencerEmitter) {
  destroyed = false
  pollPromise: Promise<void> | null = null
  triesWithNoResults = 0

  constructor(public db: Database, public lastSeen = 0) {
    super()
    // note: this does not err when surpassed, just prints a warning to stderr
    this.setMaxListeners(100)
  }

  async start() {
    const curr = await this.curr()
    this.lastSeen = curr ?? 0
    if (this.pollPromise === null) {
      this.pollPromise = this.pollDb()
    }
  }

  async destroy() {
    this.destroyed = true
    if (this.pollPromise) {
      await this.pollPromise
    }
    this.emit('close')
  }

  async curr(): Promise<number | null> {
    const got = await this.db.db
      .selectFrom('label')
      .selectAll()
      .orderBy('id', 'desc')
      .limit(1)
      .executeTakeFirst()
    return got?.id ?? null
  }

  async next(cursor: number): Promise<LabelRow | null> {
    const got = await this.db.db
      .selectFrom('label')
      .selectAll()
      .where('id', '>', cursor)
      .limit(1)
      .orderBy('id', 'asc')
      .executeTakeFirst()
    return got || null
  }

  async requestLabelRange(opts: {
    earliestId?: number
    limit?: number
  }): Promise<LabelsEvt[]> {
    const { earliestId, limit } = opts

    let seqQb = this.db.db.selectFrom('label').selectAll().orderBy('id', 'asc')
    if (earliestId !== undefined) {
      seqQb = seqQb.where('id', '>', earliestId)
    }
    if (limit !== undefined) {
      seqQb = seqQb.limit(limit)
    }

    const rows = await seqQb.execute()
    if (rows.length < 1) {
      return []
    }

    const evts: LabelsEvt[] = []
    for (const row of rows) {
      evts.push({
        seq: row.id,
        labels: [
          {
            src: row.src,
            uri: row.uri,
            cid: row.cid === '' ? undefined : row.cid,
            val: row.val,
            neg: row.neg,
            cts: row.cts,
          },
        ],
      })
    }

    return evts
  }

  private async pollDb(): Promise<void> {
    if (this.destroyed) return
    // if already polling, do not start another poll
    try {
      const evts = await this.requestLabelRange({
        earliestId: this.lastSeen,
        limit: 500,
      })
      if (evts.length > 0) {
        this.triesWithNoResults = 0
        this.emit('events', evts)
        this.lastSeen = evts.at(-1)?.seq ?? this.lastSeen
      } else {
        await this.exponentialBackoff()
      }
      this.pollPromise = this.pollDb()
    } catch (err) {
      log.error({ err, lastSeen: this.lastSeen }, 'sequencer failed to poll db')
      await this.exponentialBackoff()
      this.pollPromise = this.pollDb()
    }
  }

  // when no results, exponential backoff on pulling, with a max of a second wait
  private async exponentialBackoff(): Promise<void> {
    this.triesWithNoResults++
    const waitTime = Math.min(Math.pow(2, this.triesWithNoResults), SECOND)
    await wait(waitTime)
  }
}

type SequencerEvents = {
  events: (evts: LabelsEvt[]) => void
  close: () => void
}

export type SequencerEmitter = TypedEmitter<SequencerEvents>

export default Sequencer
