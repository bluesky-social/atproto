import EventEmitter from 'events'
import TypedEmitter from 'typed-emitter'
import { seqLogger as log } from '../logger'
import { SECOND, cborDecode, wait } from '@atproto/common'
import {
  CommitEvt,
  HandleEvt,
  SeqEvt,
  TombstoneEvt,
  formatSeqCommit,
  formatSeqHandleUpdate,
  formatSeqTombstone,
} from './events'
import { ServiceDb, RepoSeqEntry, RepoSeqInsert } from '../service-db'
import { CommitData } from '@atproto/repo'
import { PreparedWrite } from '../repo'
import { Crawlers } from '../crawlers'

export * from './events'

export class Sequencer extends (EventEmitter as new () => SequencerEmitter) {
  polling = false
  triesWithNoResults = 0

  constructor(
    public db: ServiceDb,
    public crawlers: Crawlers,
    public lastSeen = 0,
  ) {
    super()
    // note: this does not err when surpassed, just prints a warning to stderr
    this.setMaxListeners(100)
  }

  async start() {
    const curr = await this.curr()
    if (curr) {
      this.lastSeen = curr.seq ?? 0
    }
    this.pollDb()
  }

  async curr(): Promise<SeqRow | null> {
    const got = await this.db.db
      .selectFrom('repo_seq')
      .selectAll()
      .orderBy('seq', 'desc')
      .limit(1)
      .executeTakeFirst()
    return got || null
  }

  async next(cursor: number): Promise<SeqRow | null> {
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
      .where('invalidated', '=', 0)
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
      // should never hit this because of WHERE clause
      if (row.seq === null) {
        continue
      }
      const evt = cborDecode(row.event)
      if (row.eventType === 'append' || row.eventType === 'rebase') {
        seqEvts.push({
          type: 'commit',
          seq: row.seq,
          time: row.sequencedAt,
          evt: evt as CommitEvt,
        })
      } else if (row.eventType === 'handle') {
        seqEvts.push({
          type: 'handle',
          seq: row.seq,
          time: row.sequencedAt,
          evt: evt as HandleEvt,
        })
      } else if (row.eventType === 'tombstone') {
        seqEvts.push({
          type: 'tombstone',
          seq: row.seq,
          time: row.sequencedAt,
          evt: evt as TombstoneEvt,
        })
      }
    }

    return seqEvts
  }

  async pollDb() {
    // if already polling, do not start another poll
    if (this.polling) return
    try {
      this.polling = true
      const evts = await this.requestSeqRange({
        earliestSeq: this.lastSeen,
        limit: 1000,
      })
      if (evts.length > 0) {
        this.triesWithNoResults = 0
        this.emit('events', evts)
        this.lastSeen = evts.at(-1)?.seq ?? this.lastSeen
      } else {
        this.triesWithNoResults++
        // when no results, exponential backoff on pulling, with a max of a 5 second wait
        const waitTime = Math.max(
          Math.pow(2, this.triesWithNoResults),
          5 & SECOND,
        )
        await wait(waitTime)
      }
      this.pollDb()
    } catch (err) {
      log.error({ err, lastSeen: this.lastSeen }, 'sequencer failed to poll db')
      this.pollDb()
    }
  }

  async sequenceEvt(evt: RepoSeqInsert) {
    await this.db.db.insertInto('repo_seq').values(evt).execute()
    this.crawlers.notifyOfUpdate()
  }

  async sequenceCommit(
    did: string,
    commitData: CommitData,
    writes: PreparedWrite[],
  ) {
    const evt = await formatSeqCommit(did, commitData, writes)
    await this.sequenceEvt(evt)
  }

  async sequenceHandleUpdate(did: string, handle: string) {
    const evt = await formatSeqHandleUpdate(did, handle)
    await this.sequenceEvt(evt)
  }

  async sequenceTombstone(did: string) {
    const evt = await formatSeqTombstone(did)
    await this.sequenceEvt(evt)
  }
}

type SeqRow = RepoSeqEntry

type SequencerEvents = {
  events: (evts: SeqEvt[]) => void
}

export type SequencerEmitter = TypedEmitter<SequencerEvents>

export default Sequencer
