import EventEmitter from 'events'
import TypedEmitter from 'typed-emitter'
import Database from '../db'
import { seqLogger as log } from '../logger'
import { RepoSeqEntry } from '../db/tables/repo-seq'
import { z } from 'zod'
import { cborDecode, cborEncode, check, schema } from '@atproto/common'
import { blocksToCar, CidSet, CommitData, WriteOpAction } from '@atproto/repo'
import { PreparedWrite } from '../repo'
import { CID } from 'multiformats/cid'

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

  async sequenceCommit(
    dbTxn: Database,
    did: string,
    commitData: CommitData,
    writes: PreparedWrite[],
  ) {
    // @TODO handle too big
    const ops: CommitEvtOp[] = []
    const blobs = new CidSet()
    for (const w of writes) {
      const path = w.uri.collection + '/' + w.uri.rkey
      let cid: CID | null
      if (w.action === WriteOpAction.Delete) {
        cid = null
      } else {
        cid = w.cid
        w.blobs.forEach((blob) => {
          blobs.add(blob.cid)
        })
      }
      ops.push({ action: w.action, path, cid })
    }
    const carSlice = await blocksToCar(commitData.commit, commitData.blocks)
    const evt: CommitEvt = {
      rebase: false,
      tooBig: false,
      repo: did,
      commit: commitData.commit,
      prev: commitData.prev,
      ops,
      blocks: carSlice,
      blobs: blobs.toList(),
    }
    await dbTxn.db
      .insertInto('repo_seq')
      .values({
        did,
        eventType: 'append' as const,
        event: cborEncode(evt),
        sequencedAt: new Date().toISOString(),
      })
      .execute()
    await this.db.notify('repo_seq')
  }

  async sequenceHandleUpdate(did: string, handle: string) {
    const evt: HandleEvt = {
      did,
      handle,
    }
    await this.db.db.insertInto('repo_seq').values({
      did,
      eventType: 'handle',
      event: cborEncode(evt),
      sequencedAt: new Date().toISOString(),
    })
  }
}

const commitEvtOp = z.object({
  action: z.union([
    z.literal('create'),
    z.literal('update'),
    z.literal('delete'),
  ]),
  path: z.string(),
  cid: schema.cid.nullable(),
})
type CommitEvtOp = z.infer<typeof commitEvtOp>

const commitEvt = z.object({
  rebase: z.boolean(),
  tooBig: z.boolean(),
  repo: z.string(),
  commit: schema.cid,
  prev: schema.cid.nullable(),
  blocks: schema.bytes,
  ops: z.array(commitEvtOp),
  blobs: z.array(schema.cid),
})
type CommitEvt = z.infer<typeof commitEvt>

const handleEvt = z.object({
  did: z.string(),
  handle: z.string(),
})
type HandleEvt = z.infer<typeof handleEvt>

type TypedCommitEvt = {
  type: 'commit'
  seq: number
  time: string
  evt: CommitEvt
}
type TypedHandleEvt = {
  type: 'handle'
  seq: number
  time: string
  evt: HandleEvt
}
export type SeqEvt = TypedCommitEvt | TypedHandleEvt

type SequencerEvents = {
  events: (evts: SeqEvt[]) => void
}

export type SequencerEmitter = TypedEmitter<SequencerEvents>

export default Sequencer
