import EventEmitter from 'events'
import TypedEmitter from 'typed-emitter'
import { seqLogger as log } from '../logger'
import { SECOND, cborDecode, wait } from '@atproto/common'
import { CommitData } from '@atproto/repo'
import {
  CommitEvt,
  HandleEvt,
  IdentityEvt,
  SeqEvt,
  TombstoneEvt,
  formatSeqCommit,
  formatSeqHandleUpdate,
  formatSeqIdentityEvt,
  formatSeqTombstone,
} from './events'
import {
  SequencerDb,
  getMigrator,
  RepoSeqEntry,
  RepoSeqInsert,
  getDb,
} from './db'
import { PreparedWrite } from '../repo'
import { Crawlers } from '../crawlers'

export * from './events'

export class Sequencer extends (EventEmitter as new () => SequencerEmitter) {
  db: SequencerDb
  destroyed = false
  pollPromise: Promise<void> | null = null
  triesWithNoResults = 0

  constructor(
    dbLocation: string,
    public crawlers: Crawlers,
    public lastSeen = 0,
    disableWalAutoCheckpoint = false,
  ) {
    super()
    // note: this does not err when surpassed, just prints a warning to stderr
    this.setMaxListeners(100)
    this.db = getDb(dbLocation, disableWalAutoCheckpoint)
  }

  async start() {
    await this.db.ensureWal()
    const migrator = getMigrator(this.db)
    await migrator.migrateToLatestOrThrow()
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
      .selectFrom('repo_seq')
      .selectAll()
      .orderBy('seq', 'desc')
      .limit(1)
      .executeTakeFirst()
    return got?.seq ?? null
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

  async earliestAfterTime(time: string): Promise<SeqRow | null> {
    const got = await this.db.db
      .selectFrom('repo_seq')
      .selectAll()
      .where('sequencedAt', '>=', time)
      .orderBy('sequencedAt', 'asc')
      .limit(1)
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
      } else if (row.eventType === 'identity') {
        seqEvts.push({
          type: 'identity',
          seq: row.seq,
          time: row.sequencedAt,
          evt: evt as IdentityEvt,
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

  private async pollDb(): Promise<void> {
    if (this.destroyed) return
    // if already polling, do not start another poll
    try {
      const evts = await this.requestSeqRange({
        earliestSeq: this.lastSeen,
        limit: 1000,
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

  async sequenceEvt(evt: RepoSeqInsert) {
    await this.db.executeWithRetry(
      this.db.db.insertInto('repo_seq').values(evt),
    )
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

  async sequenceIdentityEvt(did: string) {
    const evt = await formatSeqIdentityEvt(did)
    await this.sequenceEvt(evt)
  }

  async sequenceTombstone(did: string) {
    const evt = await formatSeqTombstone(did)
    await this.sequenceEvt(evt)
  }

  async deleteAllForUser(did: string) {
    await this.db.executeWithRetry(
      this.db.db
        .deleteFrom('repo_seq')
        .where('did', '=', did)
        .where('eventType', '!=', 'tombstone'),
    )
  }
}

type SeqRow = RepoSeqEntry

type SequencerEvents = {
  events: (evts: SeqEvt[]) => void
  close: () => void
}

export type SequencerEmitter = TypedEmitter<SequencerEvents>

export default Sequencer
