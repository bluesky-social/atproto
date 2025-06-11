import EventEmitter from 'node:events'
import { Selectable } from 'kysely'
import { PoolClient } from 'pg'
import TypedEmitter from 'typed-emitter'
import { Database } from '../db'
import { Label as LabelTable, LabelChannel } from '../db/schema/label'
import { Labels as LabelsEvt } from '../lexicon/types/com/atproto/label/subscribeLabels'
import { seqLogger as log } from '../logger'
import { ModerationService } from '../mod-service'

export type { Labels as LabelsEvt } from '../lexicon/types/com/atproto/label/subscribeLabels'
type LabelRow = Selectable<LabelTable>

export class Sequencer extends (EventEmitter as new () => SequencerEmitter) {
  db: Database
  destroyed = false
  pollPromise: Promise<void> | undefined
  queued = false
  conn: PoolClient | undefined

  constructor(
    public modSrvc: ModerationService,
    public lastSeen = 0,
  ) {
    super()
    this.db = modSrvc.db
    // note: this does not err when surpassed, just prints a warning to stderr
    this.setMaxListeners(100)
  }

  async start() {
    const curr = await this.curr()
    this.lastSeen = curr ?? 0
    this.poll()
    this.conn = await this.db.pool.connect()
    this.conn.query(`listen ${LabelChannel}`) // if this errors, unhandled rejection should cause process to exit
    this.conn.on('notification', (notif) => {
      if (notif.channel === LabelChannel) {
        this.poll()
      }
    })
  }

  async destroy() {
    if (this.destroyed) return
    this.destroyed = true
    if (this.conn) {
      this.conn.release()
      this.conn = undefined
    }
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

    const evts: LabelsEvt[] = await Promise.all(
      rows.map(async (row) => {
        const formatted = await this.modSrvc.views.formatLabelAndEnsureSig(row)
        return { seq: row.id, labels: [formatted] }
      }),
    )

    return evts
  }

  private poll() {
    if (this.destroyed) return
    if (this.pollPromise) {
      this.queued = true
      return
    }
    this.queued = false
    this.pollPromise = this.requestLabelRange({
      earliestId: this.lastSeen,
      limit: 500,
    })
      .then((evts) => {
        this.emit('events', evts)
        this.lastSeen = evts.at(-1)?.seq ?? this.lastSeen
        if (evts.length > 0) {
          this.queued = true
        }
      })
      .catch((err) => {
        log.error(
          { err, lastSeen: this.lastSeen },
          'sequencer failed to poll db',
        )
      })
      .finally(() => {
        this.pollPromise = undefined
        if (this.queued) {
          this.poll()
        }
      })
  }
}

type SequencerEvents = {
  events: (evts: LabelsEvt[]) => void
  close: () => void
}

export type SequencerEmitter = TypedEmitter<SequencerEvents>
