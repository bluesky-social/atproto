import EventEmitter from 'node:events'
import TypedEmitter from 'typed-emitter'
import { SECOND, cborDecode, wait } from '@atproto/common'
import { AccountStatus } from '../account-manager/helpers/account'
import { Crawlers } from '../crawlers'
import { seqLogger as log } from '../logger'
import { CommitDataWithOps, SyncEvtData } from '../repo'
import {
  RepoSeqEntry,
  RepoSeqInsert,
  SequencerDb,
  getDb,
  getMigrator,
} from './db'
import {
  AccountEvt,
  CommitEvt,
  IdentityEvt,
  SeqEvt,
  SyncEvt,
  formatSeqAccountEvt,
  formatSeqCommit,
  formatSeqIdentityEvt,
  formatSeqSyncEvt,
} from './events'

export * from './events'

export class Sequencer extends (EventEmitter as new () => SequencerEmitter) {
  db: SequencerDb
  destroyed = false
  pollPromise: Promise<void> | null = null
  triesWithNoResults = 0

  constructor(
    public dbLocation: string,
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

    return parseRepoSeqRows(rows)
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

  async sequenceEvt(evt: RepoSeqInsert): Promise<number> {
    const [{ seq }] = await this.db.executeWithRetry(
      this.db.db.insertInto('repo_seq').values(evt).returning('seq'),
    )
    this.crawlers.notifyOfUpdate()
    return seq
  }

  async sequenceCommit(
    did: string,
    commitData: CommitDataWithOps,
  ): Promise<number> {
    const evt = await formatSeqCommit(did, commitData)
    return await this.sequenceEvt(evt)
  }

  async sequenceSyncEvt(did: string, data: SyncEvtData) {
    const evt = await formatSeqSyncEvt(did, data)
    return await this.sequenceEvt(evt)
  }

  async sequenceIdentityEvt(did: string, handle?: string): Promise<number> {
    const evt = await formatSeqIdentityEvt(did, handle)
    return await this.sequenceEvt(evt)
  }

  async sequenceAccountEvt(
    did: string,
    status: AccountStatus,
  ): Promise<number> {
    const evt = await formatSeqAccountEvt(did, status)
    return await this.sequenceEvt(evt)
  }

  async deleteAllForUser(did: string, excludingSeqs: number[] = []) {
    await this.db.executeWithRetry(
      this.db.db
        .deleteFrom('repo_seq')
        .where('did', '=', did)
        .if(excludingSeqs.length > 0, (qb) =>
          qb.where('seq', 'not in', excludingSeqs),
        ),
    )
  }
}

export const parseRepoSeqRows = (rows: RepoSeqEntry[]): SeqEvt[] => {
  const seqEvts: SeqEvt[] = []
  for (const row of rows) {
    // should never hit this because of WHERE clause
    if (row.seq === null) {
      continue
    }
    const evt = cborDecode(row.event)
    if (row.eventType === 'append') {
      seqEvts.push({
        type: 'commit',
        seq: row.seq,
        time: row.sequencedAt,
        evt: evt as CommitEvt,
      })
    } else if (row.eventType === 'sync') {
      seqEvts.push({
        type: 'sync',
        seq: row.seq,
        time: row.sequencedAt,
        evt: evt as SyncEvt,
      })
    } else if (row.eventType === 'identity') {
      seqEvts.push({
        type: 'identity',
        seq: row.seq,
        time: row.sequencedAt,
        evt: evt as IdentityEvt,
      })
    } else if (row.eventType === 'account') {
      seqEvts.push({
        type: 'account',
        seq: row.seq,
        time: row.sequencedAt,
        evt: evt as AccountEvt,
      })
    }
  }
  return seqEvts
}

type SeqRow = RepoSeqEntry

type SequencerEvents = {
  events: (evts: SeqEvt[]) => void
  close: () => void
}

export type SequencerEmitter = TypedEmitter<SequencerEvents>

export default Sequencer
