import { writeCar } from '@atproto/repo'
import { CID } from 'multiformats/cid'
import Database from './db'

export class Sequencer {
  polling = false
  queued = false

  listeners: ListenerCB[] = []

  constructor(public db: Database, public lastSeen?: number) {}

  static async start(db: Database) {
    const found = await db.db
      .selectFrom('sequenced_event')
      .selectAll()
      .orderBy('seq', 'desc')
      .limit(1)
      .executeTakeFirst()
    const lastSeen = found ? found.seq : undefined
    const seq = new Sequencer(db, lastSeen)
    return seq
  }

  listenToDb() {
    this.db.listenFor('repo_append', () => {
      if (this.polling) {
        this.queued = true
      } else {
        this.pollDb()
      }
    })
  }

  async pollDb() {
    let qb = this.db.db
      .selectFrom('sequenced_event')
      .innerJoin('repo_commit_block', (join) =>
        join
          .onRef('repo_commit_block.creator', '=', 'sequenced_event.did')
          .onRef('repo_commit_block.commit', '=', 'repo_commit_block.commit'),
      )
      .innerJoin('ipld_block', (join) =>
        // @TODO add creator check
        join.onRef('ipld_block.cid', '=', 'repo_commit_block.block'),
      )
      .select([
        'sequenced_event.seq as seq',
        'sequenced_event.did as did',
        'sequenced_event.commit as commit',
        'ipld_block.cid as cid',
        'ipld_block.content as content',
      ])

    if (this.lastSeen !== undefined) {
      qb = qb.where('seq', '>', this.lastSeen)
    }
    const res: SeqRow[] = await qb.execute()
    const bySeq = res.reduce((acc, cur) => {
      acc[cur.seq] ??= []
      acc[cur.seq].push(cur)
      return acc
    }, {} as Record<number, SeqRow[]>)
    const seqs = Object.keys(bySeq).sort()
    for (const seqStr of seqs) {
      const seq = parseInt(seqStr)
      const rows = bySeq[seq]
      if (!rows || rows.length === 0) {
        continue
      }
      const commit = CID.parse(rows[0].commit)
      const carSlice = await writeCar(commit, async (car) => {
        for (const row of rows) {
          await car.put({ cid: CID.parse(row.cid), bytes: row.content })
        }
      })
      const evt: RepoAppendEvent = {
        seq,
        repo: rows[0].did,
        repoAppend: {
          commit: commit.toString(),
          carSlice,
        },
      }
      for (const listener of this.listeners) {
        listener(evt)
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

  listenAll(cb: ListenerCB) {
    this.listeners.push(cb)
  }
}

type ListenerCB = (evt: RepoAppendEvent) => void

type SeqRow = {
  seq: number
  did: string
  commit: string
  cid: string
  content: Uint8Array
}

type RepoAppendEvent = {
  seq: number
  repo: string
  repoAppend: {
    commit: string
    carSlice: Uint8Array
  }
}

export default Sequencer
