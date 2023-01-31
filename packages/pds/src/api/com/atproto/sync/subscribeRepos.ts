import { CID } from 'multiformats/cid'
import * as repo from '@atproto/repo'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import SqlRepoStorage from '../../../../sql-repo-storage'
import AppContext from '../../../../context'
import { SequencedEvent } from '../../../../db/tables/sequenced-event'
import Database from '../../../../db'
import { jsxOpeningFragment } from '@babel/types'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.subscribeRepos(async function* ({ params }) {
    const outbox = new Outbox(ctx.db, params.lastSeen || -1)
    for await (const evt of outbox.events()) {
      yield evt
    }
  })
}

class Outbox {
  buffer: SequencedEvent[] = []
  isBackfilling = true

  constructor(public db: Database, public lastSeen: number) {}

  addToBuffer(evt: SequencedEvent) {
    this.buffer.push(evt)
  }

  async processHistorical(count: number): Promise<unknown[]> {
    const getEvtsQB = this.db.db
      .selectFrom('sequenced_event')
      .where('sequenced_event.seq', '>', this.lastSeen)
      .selectAll()
      .limit(count)

    const getBlocks = this.db.db
      .selectFrom('repo_commit_block')
      .innerJoin(getEvtsQB.as('event'), (join) =>
        join
          .onRef('event.did', '=', 'repo_commit_block.creator')
          .onRef('event.commit', '=', 'repo_commit_block.commit'),
      )
      // @TODO add check on creator
      .innerJoin('ipld_block', 'ipld_block.cid', 'repo_commit_block.block')
      .select([
        'event.seq as seq',
        'event.did as did',
        'event.commit as commit',
        'ipld_block.cid as cid',
        'ipld_block.content as content',
      ])
      .execute()

    const getOps = this.db.db
      .selectFrom('repo_op')
      .innerJoin(getEvtsQB.as('event'), (join) =>
        join
          .onRef('event.did', '=', 'repo_op.did')
          .onRef('event.commit', '=', 'repo_op.commit'),
      )
      .select([
        'event.seq as seq',
        'event.did as did',
        'event.commit as commit',
        'repo_op.action as action',
        'repo_op.collection as collection',
        'repo_op.rkey as rkey',
      ])
      .execute()

    const [blocks, ops] = await Promise.all([getBlocks, getOps])

    const blocksBySeq = blocks.reduce(keyBySeq, {})
    const opsBySeq = ops.reduce(keyBySeq, {})

    const evts: any[] = []

    for (const seq of Object.keys(blocksBySeq)) {
      const blocks = blocksBySeq[seq]
      if (blocks.length < 1) {
        throw new Error(`Found no blocks for seq: ${seq}`)
      }
      const ops = opsBySeq[seq]
      const carSlice = await repo.writeCar(
        CID.parse(blocks[0].commit),
        async (car) => {
          for (const block of blocks) {
            await car.put({ cid: CID.parse(block.cid), bytes: block.content })
          }
        },
      )
      evts.push({
        seq,
        repo: blocks[0].did,
        repoAppend: {
          repoOps: ops,
          carSlice,
        },
      })
    }
    return evts
  }

  async *events(): AsyncIterable<unknown> {}
}

const keyBySeq = <T extends { seq: number }>(
  acc: Record<number, T[]>,
  cur: T,
) => {
  acc[cur.seq] ??= []
  acc[cur.seq].push(cur)
  return acc
}
