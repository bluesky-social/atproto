import assert from 'node:assert'
import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import { cborDecode, wait } from '@atproto/common'
import { DisconnectError, Subscription } from '@atproto/xrpc-server'
import {
  WriteOpAction,
  readCarWithRoot,
  cborToLexRecord,
  def,
  Commit,
} from '@atproto/repo'
import { ValidationError } from '@atproto/lexicon'
import { OutputSchema as Message } from '../lexicon/types/com/atproto/sync/subscribeRepos'
import * as message from '../lexicon/types/com/atproto/sync/subscribeRepos'
import { ids, lexicons } from '../lexicon/lexicons'
import Database from '../db'
import AppContext from '../context'
import { Leader } from '../db/leader'
import { IndexingService } from '../services/indexing'
import { subLogger } from '../logger'
import { ConsecutiveList, LatestQueue, PartitionedQueue } from './util'

const METHOD = ids.ComAtprotoSyncSubscribeRepos
export const REPO_SUB_ID = 1000

export class RepoSubscription {
  leader = new Leader(this.subLockId, this.ctx.db)
  repoQueue: PartitionedQueue
  cursorQueue = new LatestQueue()
  consecutive = new ConsecutiveList<number>()
  destroyed = false
  lastSeq: number | undefined
  lastCursor: number | undefined
  indexingSvc: IndexingService

  constructor(
    public ctx: AppContext,
    public service: string,
    public subLockId = REPO_SUB_ID,
    public concurrency = Infinity,
  ) {
    this.repoQueue = new PartitionedQueue({ concurrency })
    this.indexingSvc = ctx.services.indexing(ctx.db)
  }

  async run() {
    while (!this.destroyed) {
      try {
        const { ran } = await this.leader.run(async ({ signal }) => {
          const sub = this.getSubscription({ signal })
          for await (const msg of sub) {
            const details = getMessageDetails(msg)
            if ('info' in details) {
              // These messages are not sequenced, we just log them and carry on
              subLogger.warn(
                { provider: this.service, message: loggableMessage(msg) },
                `repo subscription ${
                  details.info ? 'info' : 'unknown'
                } message`,
              )
              continue
            }
            this.lastSeq = details.seq
            const item = this.consecutive.push(details.seq)
            this.repoQueue
              .add(details.repo, () => this.handleMessage(details.message))
              .catch((err) => {
                // We log messages we can't process and move on. Barring a
                // durable queue this is the best we can do for now: otherwise
                // the cursor would get stuck on a poison message.
                subLogger.error(
                  {
                    err,
                    provider: this.service,
                    message: loggableMessage(msg),
                  },
                  'repo subscription message processing error',
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
            await this.repoQueue.main.onEmpty() // backpressure
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
    this.repoQueue = new PartitionedQueue({ concurrency: this.concurrency })
    this.cursorQueue = new LatestQueue()
    this.consecutive = new ConsecutiveList<number>()
    await this.run()
  }

  private async handleMessage(msg: ProcessableMessage) {
    if (message.isCommit(msg)) {
      await this.handleCommit(msg)
    } else if (message.isHandle(msg)) {
      await this.handleUpdateHandle(msg)
    } else if (message.isTombstone(msg)) {
      await this.handleTombstone(msg)
    } else if (message.isMigrate(msg)) {
      // Ignore migrations
    } else {
      const exhaustiveCheck: never = msg
      throw new Error(`Unhandled message type: ${exhaustiveCheck['$type']}`)
    }
  }

  private async handleCommit(msg: message.Commit) {
    const indexRecords = async () => {
      const { root, rootCid, ops } = await getOps(msg)
      if (msg.tooBig) {
        await this.indexingSvc.indexRepo(msg.repo, rootCid.toString())
        await this.indexingSvc.setCommitLastSeen(root, msg)
        return
      }
      if (msg.rebase) {
        const needsReindex = await this.indexingSvc.checkCommitNeedsIndexing(
          root,
        )
        if (needsReindex) {
          await this.indexingSvc.indexRepo(msg.repo, rootCid.toString())
        }
        await this.indexingSvc.setCommitLastSeen(root, msg)
        return
      }
      for (const op of ops) {
        if (op.action === WriteOpAction.Delete) {
          await this.indexingSvc.deleteRecord(op.uri)
        } else {
          try {
            await this.indexingSvc.indexRecord(
              op.uri,
              op.cid,
              op.record,
              op.action, // create or update
              msg.time,
            )
          } catch (err) {
            if (err instanceof ValidationError) {
              subLogger.warn(
                {
                  did: msg.repo,
                  commit: msg.commit.toString(),
                  uri: op.uri.toString(),
                  cid: op.cid.toString(),
                },
                'skipping indexing of invalid record',
              )
            } else {
              subLogger.error(
                {
                  err,
                  did: msg.repo,
                  commit: msg.commit.toString(),
                  uri: op.uri.toString(),
                  cid: op.cid.toString(),
                },
                'skipping indexing due to error processing record',
              )
            }
          }
        }
      }
      await this.indexingSvc.setCommitLastSeen(root, msg)
    }
    const results = await Promise.allSettled([
      indexRecords(),
      this.indexingSvc.indexHandle(msg.repo, msg.time),
    ])
    handleAllSettledErrors(results)
  }

  private async handleUpdateHandle(msg: message.Handle) {
    await this.indexingSvc.indexHandle(msg.did, msg.time, true)
  }

  private async handleTombstone(msg: message.Tombstone) {
    await this.indexingSvc.tombstoneActor(msg.did)
  }

  private async handleCursor(seq: number) {
    const { db } = this.ctx
    await db.transaction(async (tx) => {
      await this.setState(tx, { cursor: seq })
    })
  }

  async getState(): Promise<State> {
    const sub = await this.ctx.db.db
      .selectFrom('subscription')
      .selectAll()
      .where('service', '=', this.service)
      .where('method', '=', METHOD)
      .executeTakeFirst()
    const state = sub ? (JSON.parse(sub.state) as State) : { cursor: 0 }
    this.lastCursor = state.cursor
    return state
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
    tx.onCommit(() => {
      this.lastCursor = state.cursor
    })
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
              commit: ifString(value?.['commit']?.toString()),
              time: ifString(value?.['time']),
              provider: this.service,
            },
            'repo subscription skipped invalid message',
          )
        }
      },
    })
  }
}

// These are the message types that have a sequence number and a repo
type ProcessableMessage =
  | message.Commit
  | message.Handle
  | message.Migrate
  | message.Tombstone

async function getOps(
  msg: message.Commit,
): Promise<{ root: Commit; rootCid: CID; ops: PreparedWrite[] }> {
  const car = await readCarWithRoot(msg.blocks as Uint8Array)
  const rootBytes = car.blocks.get(car.root)
  assert(rootBytes, 'Missing commit block in car slice')

  const root = def.commit.schema.parse(cborDecode(rootBytes))
  const ops: PreparedWrite[] = msg.ops.map((op) => {
    const [collection, rkey] = op.path.split('/')
    assert(collection && rkey)
    if (
      op.action === WriteOpAction.Create ||
      op.action === WriteOpAction.Update
    ) {
      assert(op.cid)
      const record = car.blocks.get(op.cid)
      assert(record)
      return {
        action:
          op.action === WriteOpAction.Create
            ? WriteOpAction.Create
            : WriteOpAction.Update,
        cid: op.cid,
        record: cborToLexRecord(record),
        blobs: [],
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

  return { root, rootCid: car.root, ops }
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

function loggableMessage(msg: Message) {
  if (message.isCommit(msg)) {
    const { seq, rebase, prev, repo, commit, time, tooBig, blobs } = msg
    return {
      $type: msg.$type,
      seq,
      rebase,
      prev: prev?.toString(),
      repo,
      commit: commit.toString(),
      time,
      tooBig,
      hasBlobs: blobs.length > 0,
    }
  } else if (message.isHandle(msg)) {
    return msg
  } else if (message.isMigrate(msg)) {
    return msg
  } else if (message.isTombstone(msg)) {
    return msg
  } else if (message.isInfo(msg)) {
    return msg
  }
  return msg
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

function getMessageDetails(msg: Message):
  | { info: message.Info | null }
  | {
      seq: number
      repo: string
      message: ProcessableMessage
    } {
  if (message.isCommit(msg)) {
    return { seq: msg.seq, repo: msg.repo, message: msg }
  } else if (message.isHandle(msg)) {
    return { seq: msg.seq, repo: msg.did, message: msg }
  } else if (message.isMigrate(msg)) {
    return { seq: msg.seq, repo: msg.did, message: msg }
  } else if (message.isTombstone(msg)) {
    return { seq: msg.seq, repo: msg.did, message: msg }
  } else if (message.isInfo(msg)) {
    return { info: msg }
  }
  return { info: null }
}

function handleAllSettledErrors(results: PromiseSettledResult<unknown>[]) {
  const errors = results.filter(isRejected).map((res) => res.reason)
  if (errors.length === 0) {
    return
  }
  if (errors.length === 1) {
    throw errors[0]
  }
  throw new AggregateError(
    errors,
    'Multiple errors: ' + errors.map((err) => err?.message).join('\n'),
  )
}

function isRejected(
  result: PromiseSettledResult<unknown>,
): result is PromiseRejectedResult {
  return result.status === 'rejected'
}
