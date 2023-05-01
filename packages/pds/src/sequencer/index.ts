import EventEmitter from 'events'
import TypedEmitter from 'typed-emitter'
import Database from '../db'
import { seqLogger as log } from '../logger'
import { RepoSeqEntry } from '../db/tables/repo-seq'
import { cborDecode, check, wait } from '@atproto/common'
import { commitEvt, handleEvt, SeqEvt } from './events'

export * from './events'

export class Sequencer extends (EventEmitter as new () => SequencerEmitter) {
  polling = false
  queued = false

  constructor(public db: Database, public lastSeen = 0) {
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
    latestSeq?: number
    earliestTime?: string
    limit?: number
  }): Promise<SeqEvt[]> {
    const { earliestSeq, latestSeq, earliestTime, limit } = opts

    let seqQb = this.db.db
      .selectFrom('repo_seq')
      .selectAll()
      .orderBy('seq', 'asc')
      .where('invalidatedBy', 'is', null)
    if (earliestSeq !== undefined) {
      seqQb = seqQb.where('seq', '>', earliestSeq)
    }
    if (latestSeq !== undefined) {
      seqQb = seqQb.where('seq', '<=', latestSeq)
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

  // polling for new events
  // because of a race between sequenced times, we need to take into account that some valid events
  // may have been written at early seq numbers but not yet been commited
  private async pollAndEmit(opts?: {
    maxRetries?: number
    latestSeq?: number
  }) {
    const { maxRetries = 0, latestSeq } = opts || {}
    const evts = await this.requestSeqRange({
      earliestSeq: this.lastSeen,
      latestSeq,
    })
    const tailEvt = evts.at(-1)?.seq
    if (!tailEvt) return
    for (const evt of evts) {
      // happy path, if the seq # is unbroken, then emit
      if (evt.seq === this.lastSeen + 1) {
        this.emit('events', [evt])
        this.lastSeen = evt.seq
      } else if (maxRetries < 1) {
        break
      }
    }
    if (tailEvt <= this.lastSeen) return
    if (maxRetries < 1) return
    // if we did not have an unbroken sequence of evts,
    // then wait 50ms in the hopes that those transactions clear & retry that exact range
    // we retry twice (for a total of ~100ms) before moving on
    // anything still held up will not be emitted on live tail, but will be in backfill
    await wait(50)
    return this.pollAndEmit({
      maxRetries: maxRetries - 1,
      latestSeq: tailEvt,
    })
  }

  async pollDb() {
    try {
      await this.pollAndEmit({ maxRetries: 2 })
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
