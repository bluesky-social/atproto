import EventEmitter from 'events'
import TypedEmitter from 'typed-emitter'
import { BlockMap, writeCar } from '@atproto/repo'
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
  }): Promise<RepoEvent[]> {
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

    const events = await this.db.db
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
        'repo_seq.eventType as eventType',
        'repo_seq.sequencedAt as sequencedAt',
        'repo_commit_history.prev as prev',
      ])
      .execute()

    const blocks = await this.db.db
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

    const blocksBySeq = blocks.reduce((acc, cur) => {
      acc[cur.seq] ??= new BlockMap()
      acc[cur.seq].set(CID.parse(cur.cid), cur.content)
      return acc
    }, {} as Record<number, BlockMap>)

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
        return {
          seq: evt.seq,
          time: evt.sequencedAt,
          repo: evt.did,
          commit: evt.commit,
          eventType: evt.eventType,
          blocks: carSlice,
        }
      }),
    )
  }

  async pollDb() {
    const evts = await this.requestSeqRange({ earliestSeq: this.lastSeen })
    for (const evt of evts) {
      this.lastSeen = evt.seq
      this.emit('event', evt)
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

export type RepoEvent = {
  seq: number
  time: string
  repo: string
  commit: string
  eventType: string
  blocks: Uint8Array
}

type SequencerEvents = {
  event: (evt: RepoEvent) => void
}

export type SequencerEmitter = TypedEmitter<SequencerEvents>

export default Sequencer
