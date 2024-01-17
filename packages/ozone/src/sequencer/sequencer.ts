import EventEmitter from 'events'
import TypedEmitter from 'typed-emitter'
import { seqLogger as log } from '../logger'
import Database from '../db'
import { Labels as LabelsEvt } from '../lexicon/types/com/atproto/label/subscribeLabels'
import { Label as LabelTable } from '../db/schema/label'
import { Selectable } from 'kysely'
import { ModerationService } from '../mod-service'

export type { Labels as LabelsEvt } from '../lexicon/types/com/atproto/label/subscribeLabels'
type LabelRow = Selectable<LabelTable>

export class Sequencer extends (EventEmitter as new () => SequencerEmitter) {
  destroyed = false
  pollPromise: Promise<void> = Promise.resolve()
  pollTimer: NodeJS.Timer | undefined
  triesWithNoResults = 0
  db: Database

  constructor(public modService: ModerationService, public lastSeen = 0) {
    super()
    // note: this does not err when surpassed, just prints a warning to stderr
    this.setMaxListeners(100)
    this.db = modService.db
  }

  async start() {
    const curr = await this.curr()
    this.lastSeen = curr ?? 0
    this.poll()
  }

  async destroy() {
    this.destroyed = true
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
    }
    await this.pollPromise
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
        const label = await this.modService.views.formatLabel(row)
        return {
          seq: row.id,
          labels: [label],
        }
      }),
    )

    return evts
  }

  private poll() {
    if (this.destroyed) return
    this.requestLabelRange({
      earliestId: this.lastSeen,
      limit: 500,
    })
      .then((evts) => {
        this.emit('events', evts)
        this.lastSeen = evts.at(-1)?.seq ?? this.lastSeen
      })
      .catch((err) => {
        log.error(
          { err, lastSeen: this.lastSeen },
          'sequencer failed to poll db',
        )
      })
      .finally(() => {
        this.pollTimer = setTimeout(() => this.poll(), 100)
      })
  }
}

type SequencerEvents = {
  events: (evts: LabelsEvt[]) => void
  close: () => void
}

export type SequencerEmitter = TypedEmitter<SequencerEvents>

export default Sequencer
