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

  static async start(db: Database) {
    const found = await db.db
      .selectFrom('repo_seq')
      .selectAll()
      .orderBy('seq', 'desc')
      .limit(1)
      .executeTakeFirst()
    const lastSeen = found ? found.seq : undefined
    const seq = new Sequencer(db, lastSeen)
    seq.listenToDb()
    return seq
  }

  listenToDb() {
    this.db.channels.repo_seq.on('message', () => {
      if (this.polling) {
        this.queued = true
      } else {
        this.polling = true
        this.pollDb()
      }
    })
  }

  async requestSeqRange(
    firstExclusive?: number,
    lastInclusive?: number,
    limit?: number,
  ): Promise<MaybeRepoEvent[]> {
    let qb = this.db.db
      .selectFrom('repo_seq')
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
        'ipld_block.cid as cid',
        'ipld_block.content as content',
      ])

    if (firstExclusive !== undefined) {
      qb = qb.where('seq', '>', firstExclusive)
    }
    if (lastInclusive !== undefined) {
      qb = qb.where('seq', '<=', lastInclusive)
    }
    if (limit !== undefined) {
      qb = qb.limit(limit)
    }

    const res: SeqRow[] = await qb.execute()
    const bySeq = res.reduce((acc, cur) => {
      acc[cur.seq] ??= []
      acc[cur.seq].push(cur)
      return acc
    }, {} as Record<number, SeqRow[]>)
    const seqs = Object.keys(bySeq)
      .map((seq) => parseInt(seq))
      .sort()
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
        repoAppend: {
          commit: commit.toString(),
          carSlice,
        },
      })
    }
    return evts
  }

  async pollDb() {
    const evts = await this.requestSeqRange(this.lastSeen)
    for (const evt of evts) {
      if (evt !== null) {
        this.emit('event', evt)
      }
    }
    // check if we should continue polling
    if (this.queued === false) {
      this.polling === false
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
  cid: string
  content: Uint8Array
}

export type RepoEvent = {
  seq: number
  repo: string
  repoAppend: {
    commit: string
    carSlice: Uint8Array
  }
}

type MaybeRepoEvent = RepoEvent | null

type SequencerEvents = {
  event: (evt: RepoEvent) => void
}

type SequencerEmitter = TypedEmitter<SequencerEvents>

export default Sequencer
