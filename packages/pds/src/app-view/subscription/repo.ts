import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import { wait } from '@atproto/common'
import { DisconnectError, Subscription } from '@atproto/xrpc-server'
import {
  MemoryBlockstore,
  MST,
  WriteOpAction,
  parseDataKey,
  readCarWithRoot,
  def as repoDef,
} from '@atproto/repo'
import { PreparedWrite } from '../../repo'
import { OutputSchema as Message } from '../../lexicon/types/com/atproto/sync/subscribeAllRepos'
import { ids, lexicons } from '../../lexicon/lexicons'
import Database from '../../db'
import AppContext from '../../context'
import { Leader } from '../../db/leader'
import { appViewLogger } from '../logger'

const METHOD = ids.ComAtprotoSyncSubscribeAllRepos
export const REPO_SUB_ID = 1000

export class RepoSubscription {
  leader = new Leader(REPO_SUB_ID, this.ctx.db)
  destroyed = false
  constructor(public ctx: AppContext, public service: string) {}

  async run() {
    const { db } = this.ctx
    while (!this.destroyed) {
      try {
        const { ran } = await this.leader.run(async ({ signal }) => {
          const sub = this.getSubscription({ signal })
          for await (const msg of sub) {
            try {
              const ops = await getOps(msg)
              await db.transaction(async (tx) => {
                await this.handleOps(tx, ops, msg.time)
                await this.setState(tx, { cursor: msg.seq })
              })
            } catch (err) {
              throw new ProcessingError(msg, { cause: err })
            }
          }
        })
        if (ran && !this.destroyed) {
          throw new Error('Repo sub completed, but should be persistent')
        }
      } catch (_err) {
        const msg = _err instanceof ProcessingError ? _err.msg : undefined
        const err = _err instanceof ProcessingError ? _err.cause : _err
        appViewLogger.error(
          {
            err,
            seq: msg?.seq,
            repo: msg?.repo,
            commit: msg?.commit,
            time: msg?.time,
            service: this.service,
          },
          'repo subscription errored',
        )
      }
      if (!this.destroyed) {
        await wait(5000 + jitter(1000))
      }
    }
  }

  destroy() {
    this.destroyed = true
    this.leader.destroy(new DisconnectError())
  }

  private async handleOps(
    tx: Database,
    ops: PreparedWrite[],
    timestamp: string,
  ) {
    const { services } = this.ctx
    const indexingTx = services.appView.indexing(tx)
    for (const op of ops) {
      if (
        op.action === WriteOpAction.Create ||
        op.action === WriteOpAction.Update
      ) {
        await indexingTx.indexRecord(op.uri, op.cid, op.record, timestamp)
      } else if (op.action === WriteOpAction.Delete) {
        await indexingTx.deleteRecord(op.uri)
      } else {
        const exhaustiveCheck: never = op
        throw new Error(`Unsupported op: ${exhaustiveCheck?.['action']}`)
      }
    }
  }

  async getState(): Promise<State> {
    const sub = await this.ctx.db.db
      .selectFrom('subscription')
      .selectAll()
      .where('service', '=', this.service)
      .where('method', '=', METHOD)
      .executeTakeFirst()
    return sub ? (JSON.parse(sub.state) as State) : { cursor: 0 }
  }

  private async setState(tx: Database, state: State): Promise<void> {
    tx.assertTransaction()
    const res = await tx.db
      .updateTable('subscription')
      .where('service', '=', this.service)
      .where('method', '=', METHOD)
      .set({ state: JSON.stringify(state) })
      .executeTakeFirst()
    if (res.numUpdatedRows < 1) {
      await tx.db
        .insertInto('subscription')
        .values({
          service: this.service,
          method: METHOD,
          state: JSON.stringify(state),
        })
        .executeTakeFirst()
    }
  }

  private getSubscription(opts: { signal: AbortSignal }) {
    return new Subscription({
      service: this.service,
      method: METHOD,
      signal: opts.signal,
      getParams: () => this.getState(),
      onReconnectError: (err, reconnects, initial) => {
        appViewLogger.warn(
          { err, reconnects, initial },
          'repo subscription reconnect',
        )
      },
      validate: (value) => {
        try {
          return lexicons.assertValidXrpcMessage<Message>(METHOD, value)
        } catch (err) {
          appViewLogger.warn(
            {
              err,
              seq: ifNumber(value?.['seq']),
              repo: ifString(value?.['repo']),
              commit: ifString(value?.['commit']),
              time: ifString(value?.['time']),
              service: this.service,
            },
            'repo subscription skipped invalid message',
          )
        }
      },
    })
  }
}

async function getOps(msg: Message): Promise<PreparedWrite[]> {
  const claims = await blocksToRecords(msg.blocks as Uint8Array)
  return claims.map(({ collection, rkey, cid, record }) => ({
    action: WriteOpAction.Create,
    cid,
    record,
    blobs: [], // @TODO need to determine how the app-view provides URLs for processed blobs
    uri: AtUri.make(msg.repo, collection, rkey),
  }))
}

// @TODO temporary until ops are in the sub messages, based on repo.verifyRecords().
async function blocksToRecords(blocks: Uint8Array): Promise<CarRecord[]> {
  const car = await readCarWithRoot(blocks)
  const blockstore = new MemoryBlockstore(car.blocks)
  const commit = await blockstore.readObj(car.root, repoDef.commit)
  const root = await blockstore.readObj(commit.root, repoDef.repoRoot)
  const mst = MST.load(blockstore, root.data)
  const records: CarRecord[] = []
  const leaves = await mst.reachableLeaves()
  for (const leaf of leaves) {
    const { collection, rkey } = parseDataKey(leaf.key)
    const record = await blockstore.attemptRead(leaf.value, repoDef.record)
    if (record) {
      records.push({
        collection,
        rkey,
        cid: leaf.value,
        record: record.obj,
      })
    }
  }
  return records
}

function jitter(maxMs) {
  return Math.round((Math.random() - 0.5) * maxMs * 2)
}

function ifString(val: unknown): string | undefined {
  return typeof val === 'string' ? val : undefined
}

function ifNumber(val: unknown): number | undefined {
  return typeof val === 'number' ? val : undefined
}

class ProcessingError extends Error {
  constructor(public msg: Message, opts: { cause: unknown }) {
    super('processing error', opts)
  }
}

type CarRecord = {
  collection: string
  rkey: string
  cid: CID
  record: Record<string, unknown>
}

type State = { cursor: number }
