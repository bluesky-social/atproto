import EventEmitter from 'events'
import TypedEmitter from 'typed-emitter'
import Database from '../db'
import { seqLogger as log } from '../logger'
import { RepoSeqEntry } from '../db/tables/repo-seq'
import { cborDecode, check } from '@atproto/common'
import { commitEvt, handleEvt, SeqEvt } from './events'

export * from './events'

export class Sequencer extends (EventEmitter as new () => SequencerEmitter) {
  polling = false
  queued = false

  constructor(public db: Database, public lastSeen?: number) {
    super()
    // note: this does not err when surpassed, just prints a warning to stderr
    this.setMaxListeners(100)
  }

  async start() {
    const curr = await this.curr()
    if (curr) {
      this.lastSeen = curr.seq
    }
    this.db.channels.repo_seq.addListener('message', () => {
      if (this.polling) {
        this.queued = true
      } else {
        this.polling = true
        this.pollDb()
      }
    })
  }

  async curr(): Promise<RepoSeqEntry | null> {
    const got = await this.db.db
      .selectFrom('repo_seq')
      .selectAll()
      .orderBy('seq', 'desc')
      .limit(1)
      .executeTakeFirst()
    return got || null
  }

  async next(cursor: number): Promise<RepoSeqEntry | null> {
    const got = await this.db.db
      .selectFrom('repo_seq')
      .selectAll()
      .where('seq', '>', cursor)
      .limit(1)
      .orderBy('seq', 'asc')
      .executeTakeFirst()
    return got || null
  }

  async requestSeqRange(opts: {
    earliestSeq?: number
    earliestTime?: string
    limit?: number
  }): Promise<SeqEvt[]> {
    const { earliestSeq, earliestTime, limit } = opts

    let seqQb = this.db.db
      .selectFrom('repo_seq')
      .selectAll()
      .orderBy('seq', 'asc')
      .where('invalidatedBy', 'is', null)
    if (earliestSeq !== undefined) {
      seqQb = seqQb.where('seq', '>', earliestSeq)
    }
    if (earliestTime !== undefined) {
      seqQb = seqQb.where('sequencedAt', '>=', earliestTime)
    }
    if (limit !== undefined) {
      seqQb = seqQb.limit(limit)
    }

    const rows = await seqQb.execute()
    if (rows.length < 1) {
      return []
    }

    const seqEvts: SeqEvt[] = []
    for (const row of rows) {
      const evt = cborDecode(row.event)
      if (check.is(evt, commitEvt)) {
        seqEvts.push({
          type: 'commit',
          seq: row.seq,
          time: row.sequencedAt,
          evt,
        })
      } else if (check.is(evt, handleEvt)) {
        seqEvts.push({
          type: 'handle',
          seq: row.seq,
          time: row.sequencedAt,
          evt,
        })
      }
    }

    return seqEvts
  }

  async pollDb() {
    try {
      const evts = await this.requestSeqRange({ earliestSeq: this.lastSeen })
      if (evts.length > 0) {
        this.lastSeen = evts[evts.length - 1].seq
        this.emit('events', evts)
      }
    } catch (err) {
      log.error({ err, lastSeen: this.lastSeen }, 'sequencer failed to poll db')
    } finally {
      // check if we should continue polling
      if (this.queued === false) {
        this.polling = false
      } else {
        this.queued = false
        this.pollDb()
      }
    }
  }
}

type SequencerEvents = {
  events: (evts: SeqEvt[]) => void
}

export type SequencerEmitter = TypedEmitter<SequencerEvents>

export default Sequencer
