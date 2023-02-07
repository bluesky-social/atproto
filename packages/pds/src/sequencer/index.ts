import EventEmitter from 'events'
import TypedEmitter from 'typed-emitter'
import { writeCar } from '@atproto/repo'
import { CID } from 'multiformats/cid'
import Database from '../db'

export class Sequencer extends (EventEmitter as new () => SequencerEmitter) {
  polling = false
  queued = false

  constructor(public db: Database, public lastSeen?: number) {
    super()
  }

  async start() {
    const found = await this.db.db
      .selectFrom('repo_seq')
      .selectAll()
      .orderBy('seq', 'desc')
      .limit(1)
      .executeTakeFirst()
    if (found) {
      this.lastSeen = found.seq
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

  async requestSeqRange(opts: {
    earliestSeq?: number
    earliestTime?: string
    latestSeq?: number
    latestTime?: string
    limit?: number
  }): Promise<MaybeRepoEvent[]> {
    const { earliestSeq, earliestTime, latestSeq, latestTime, limit } = opts
    let seqQb = this.db.db.selectFrom('repo_seq').selectAll()
    if (earliestSeq !== undefined) {
      seqQb = seqQb.where('seq', '>', earliestSeq)
    }
    if (earliestTime !== undefined) {
      seqQb = seqQb.where('sequencedAt', '>=', earliestTime)
    }
    if (latestSeq !== undefined) {
      seqQb = seqQb.where('seq', '<=', latestSeq)
    }
    if (latestTime !== undefined) {
      seqQb = seqQb.where('sequencedAt', '<=', latestTime)
    }
    if (limit !== undefined) {
      seqQb = seqQb.limit(limit)
    }

    const res: SeqRow[] = await this.db.db
      .selectFrom(seqQb.as('repo_seq'))
      .innerJoin('repo_commit_block', (join) =>
        join
          .onRef('repo_commit_block.creator', '=', 'repo_seq.did')
          .onRef('repo_commit_block.commit', '=', 'repo_commit_block.commit'),
      )
      .innerJoin('ipld_block', (join) =>
        join
          .onRef('ipld_block.cid', '=', 'repo_commit_block.block')
          .onRef('ipld_block.creator', '=', 'repo_commit_block.creator'),
      )
      .select([
        'repo_seq.seq as seq',
        'repo_seq.did as did',
        'repo_seq.commit as commit',
        'repo_seq.eventType as eventType',
        'repo_seq.sequencedAt as sequencedAt',
        'ipld_block.cid as cid',
        'ipld_block.content as content',
      ])
      .execute()

    const bySeq = res.reduce((acc, cur) => {
      acc[cur.seq] ??= []
      acc[cur.seq].push(cur)
      return acc
    }, {} as Record<number, SeqRow[]>)
    const seqs = Object.keys(bySeq)
      .map((seq) => parseInt(seq))
      .sort((a, b) => a - b)
    const evts: MaybeRepoEvent[] = []
    for (const seq of seqs) {
      const rows = bySeq[seq]
      if (!rows || rows.length === 0) {
        evts.push(null)
      }
      const commit = CID.parse(rows[0].commit)
      const carSlice = await writeCar(commit, async (car) => {
        for (const row of rows) {
          await car.put({ cid: CID.parse(row.cid), bytes: row.content })
        }
      })
      evts.push({
        seq,
        repo: rows[0].did,
        sequencedAt: rows[0].sequencedAt,
        eventType: rows[0].eventType,
        commit: commit.toString(),
        carSlice,
      })
    }
    return evts
  }

  async pollDb() {
    const evts = await this.requestSeqRange({ earliestSeq: this.lastSeen })
    for (const evt of evts) {
      if (evt !== null) {
        this.lastSeen = evt.seq
        this.emit('event', evt)
      }
    }
    // check if we should continue polling
    if (this.queued === false) {
      this.polling = false
    } else {
      this.queued = false
      this.pollDb()
    }
  }
}

type SeqRow = {
  seq: number
  did: string
  commit: string
  eventType: string
  sequencedAt: string
  cid: string
  content: Uint8Array
}

export type RepoEvent = {
  seq: number
  repo: string
  sequencedAt: string
  commit: string
  carSlice: Uint8Array
  eventType: string
}

type MaybeRepoEvent = RepoEvent | null

type SequencerEvents = {
  event: (evt: RepoEvent) => void
}

export type SequencerEmitter = TypedEmitter<SequencerEvents>

export default Sequencer
