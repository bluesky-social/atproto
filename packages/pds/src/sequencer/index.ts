import { BlockMap, writeCar } from '@atproto/repo'
import EventEmitter from 'events'
import TypedEmitter from 'typed-emitter'
import { CID } from 'multiformats/cid'
import Database from '../db'
import { seqLogger as log } from '../logger'

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
    limit?: number
  }): Promise<RepoAppendEvent[]> {
    const { earliestSeq, earliestTime, limit } = opts
    let seqQb = this.db.db.selectFrom('repo_seq').selectAll().orderBy('seq')
    if (earliestSeq !== undefined) {
      seqQb = seqQb.where('seq', '>', earliestSeq)
    }
    if (earliestTime !== undefined) {
      seqQb = seqQb.where('sequencedAt', '>=', earliestTime)
    }
    if (limit !== undefined) {
      seqQb = seqQb.limit(limit)
    }

    const getEvents = this.db.db
      .selectFrom(seqQb.as('repo_seq'))
      .leftJoin('repo_commit_history', (join) =>
        join
          .onRef('repo_commit_history.creator', '=', 'repo_seq.did')
          .onRef('repo_commit_history.commit', '=', 'repo_seq.commit'),
      )
      .select([
        'repo_seq.seq as seq',
        'repo_seq.did as did',
        'repo_seq.commit as commit',
        'repo_seq.sequencedAt as sequencedAt',
        'repo_commit_history.prev as prev',
      ])
      .orderBy('seq', 'asc')
      .execute()

    const getBlocks = this.db.db
      .selectFrom(seqQb.as('repo_seq'))
      .innerJoin('repo_commit_block', (join) =>
        join
          .onRef('repo_commit_block.creator', '=', 'repo_seq.did')
          .onRef('repo_commit_block.commit', '=', 'repo_seq.commit'),
      )
      .innerJoin('ipld_block', (join) =>
        join
          .onRef('ipld_block.cid', '=', 'repo_commit_block.block')
          .onRef('ipld_block.creator', '=', 'repo_commit_block.creator'),
      )
      .select([
        'repo_seq.seq as seq',
        'ipld_block.cid as cid',
        'ipld_block.content as content',
      ])
      .execute()

    const getBlobs = this.db.db
      .selectFrom(seqQb.as('repo_seq'))
      .innerJoin('repo_blob', (join) =>
        join
          .onRef('repo_blob.did', '=', 'repo_blob.did')
          .onRef('repo_blob.commit', '=', 'repo_seq.commit'),
      )
      .select(['repo_seq.seq as seq', 'repo_blob.cid as cid'])
      .execute()

    const [events, blocks, blobs] = await Promise.all([
      getEvents,
      getBlocks,
      getBlobs,
    ])

    const blocksBySeq = blocks.reduce((acc, cur) => {
      acc[cur.seq] ??= new BlockMap()
      acc[cur.seq].set(CID.parse(cur.cid), cur.content)
      return acc
    }, {} as Record<number, BlockMap>)

    const blobsBySeq = blobs.reduce((acc, cur) => {
      acc[cur.seq] ??= []
      acc[cur.seq].push(cur.cid)
      return acc
    }, {} as Record<number, string[]>)

    return Promise.all(
      events.map(async (evt) => {
        const commit = CID.parse(evt.commit)
        const carSlice = await writeCar(commit, async (car) => {
          const blocks = blocksBySeq[evt.seq]
          if (blocks) {
            for (const block of blocks.entries()) {
              await car.put(block)
            }
          }
        })
        const blobs = blobsBySeq[evt.seq] || []
        return {
          seq: evt.seq,
          time: evt.sequencedAt,
          repo: evt.did,
          commit: evt.commit,
          prev: evt.prev || undefined,
          blocks: carSlice,
          blobs,
        } as RepoAppendEvent
      }),
    )
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

export type RepoAppendEvent = {
  seq: number
  time: string
  repo: string
  commit: string
  prev?: string
  blocks: Uint8Array
  blobs: string[]
}

type SequencerEvents = {
  events: (evts: RepoAppendEvent[]) => void
}

export type SequencerEmitter = TypedEmitter<SequencerEvents>

export default Sequencer
