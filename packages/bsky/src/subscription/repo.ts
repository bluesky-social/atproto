import assert from 'node:assert'
import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import { cborDecode, wait } from '@atproto/common'
import { DisconnectError, Subscription } from '@atproto/xrpc-server'
import { WriteOpAction, readCarWithRoot } from '@atproto/repo'
import { OutputSchema as Message } from '../lexicon/types/com/atproto/sync/subscribeAllRepos'
import { ids, lexicons } from '../lexicon/lexicons'
import Database from '../db'
import AppContext from '../context'
import { Leader } from '../db/leader'
import { subLogger } from '../logger'
import { ConsecutiveList, LatestQueue, PartitionedQueue } from './util'

const METHOD = ids.ComAtprotoSyncSubscribeAllRepos
export const REPO_SUB_ID = 1000

export class RepoSubscription {
  leader = new Leader(this.subLockId, this.ctx.db)
  repoQueue = new PartitionedQueue()
  cursorQueue = new LatestQueue()
  consecutive = new ConsecutiveList<Message>()
  destroyed = false

  constructor(
    public ctx: AppContext,
    public service: string,
    public subLockId = REPO_SUB_ID,
  ) {}

  async run() {
    while (!this.destroyed) {
      try {
        const { ran } = await this.leader.run(async ({ signal }) => {
          const sub = this.getSubscription({ signal })
          for await (const msg of sub) {
            const item = this.consecutive.push(msg)
            this.repoQueue
              .add(msg.repo, () => this.handleMessage(msg))
              .catch((err) => {
                subLogger.error(
                  {
                    err,
                    provider: this.service,
                    message: {
                      seq: msg.seq,
                      repo: msg.repo,
                      commit: msg.commit,
                      time: msg.time,
                    },
                  },
                  'message errored',
                )
              })
              .finally(() => {
                const latest = item.complete().at(-1)
                if (!latest) return
                this.cursorQueue
                  .add(() => this.handleCursor(latest))
                  .catch((err) => {
                    subLogger.error(
                      { err, provider: this.service },
                      'repo subscription cursor error',
                    )
                  })
              })
          }
        })
        if (ran && !this.destroyed) {
          throw new Error('Repo sub completed, but should be persistent')
        }
      } catch (err) {
        subLogger.error(
          { err, provider: this.service },
          'repo subscription error',
        )
      }
      if (!this.destroyed) {
        await wait(5000 + jitter(1000)) // wait then try to become leader
      }
    }
  }

  async destroy() {
    this.destroyed = true
    await this.repoQueue.destroy()
    await this.cursorQueue.destroy()
    this.leader.destroy(new DisconnectError())
  }

  async resume() {
    this.destroyed = false
    this.repoQueue = new PartitionedQueue()
    this.cursorQueue = new LatestQueue()
    this.consecutive = new ConsecutiveList<Message>()
    await this.run()
  }

  private async handleMessage(msg: Message) {
    const { db } = this.ctx
    const ops = await getOps(msg)
    await db.transaction(async (tx) => {
      await Promise.all([
        this.handleOps(tx, ops, msg.time),
        this.handleActor(tx, msg.repo, msg.time),
      ])
    })
  }

  private async handleCursor(msg: Message) {
    const { db } = this.ctx
    await db.transaction(async (tx) => {
      await this.setState(tx, { cursor: msg.seq })
    })
  }

  private async handleOps(
    tx: Database,
    ops: PreparedWrite[],
    timestamp: string,
  ) {
    const { services } = this.ctx
    const indexingTx = services.indexing(tx)
    for (const op of ops) {
      if (op.action === WriteOpAction.Delete) {
        await indexingTx.deleteRecord(op.uri)
      } else {
        await indexingTx.indexRecord(
          op.uri,
          op.cid,
          op.record,
          op.action, // create or update
          timestamp,
        )
      }
    }
  }

  private async handleActor(tx: Database, did: string, timestamp: string) {
    const { services } = this.ctx
    const indexingTx = services.indexing(tx)
    await indexingTx.indexActor(did, timestamp)
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

  async resetState(): Promise<void> {
    await this.ctx.db.db
      .deleteFrom('subscription')
      .where('service', '=', this.service)
      .where('method', '=', METHOD)
      .executeTakeFirst()
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
        subLogger.warn(
          { err, reconnects, initial },
          'repo subscription reconnect',
        )
      },
      validate: (value) => {
        try {
          return lexicons.assertValidXrpcMessage<Message>(METHOD, value)
        } catch (err) {
          subLogger.warn(
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
  const { ops } = msg
  const car = await readCarWithRoot(msg.blocks as Uint8Array)
  return ops.map((op) => {
    const [collection, rkey] = op.path.split('/')
    assert(collection && rkey)
    if (
      op.action === WriteOpAction.Create ||
      op.action === WriteOpAction.Update
    ) {
      assert(op.cid)
      const cid = CID.parse(op.cid)
      const record = car.blocks.get(cid)
      assert(record)
      return {
        action:
          op.action === WriteOpAction.Create
            ? WriteOpAction.Create
            : WriteOpAction.Update,
        cid,
        record: cborDecode(record),
        blobs: [], // @TODO(bsky) need to determine how the app-view provides URLs for processed blobs
        uri: AtUri.make(msg.repo, collection, rkey),
      }
    } else if (op.action === WriteOpAction.Delete) {
      return {
        action: WriteOpAction.Delete,
        uri: AtUri.make(msg.repo, collection, rkey),
      }
    } else {
      throw new Error(`Unknown repo op action: ${op.action}`)
    }
  })
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

type State = { cursor: number }

type PreparedCreate = {
  action: WriteOpAction.Create
  uri: AtUri
  cid: CID
  record: Record<string, unknown>
  blobs: CID[] // differs from similar type in pds
}

type PreparedUpdate = {
  action: WriteOpAction.Update
  uri: AtUri
  cid: CID
  record: Record<string, unknown>
  blobs: CID[] // differs from similar type in pds
}

type PreparedDelete = {
  action: WriteOpAction.Delete
  uri: AtUri
}

type PreparedWrite = PreparedCreate | PreparedUpdate | PreparedDelete
