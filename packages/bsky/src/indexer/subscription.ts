import assert from 'node:assert'
import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import { cborDecode, wait } from '@atproto/common'
import { DisconnectError } from '@atproto/xrpc-server'
import {
  WriteOpAction,
  readCarWithRoot,
  cborToLexRecord,
  def,
  Commit,
} from '@atproto/repo'
import { ValidationError } from '@atproto/lexicon'
import * as message from '../lexicon/types/com/atproto/sync/subscribeRepos'
import { Leader } from '../db/leader'
import { IndexingService } from '../services/indexing'
import { subLogger } from '../logger'
import {
  ConsecutiveItem,
  ConsecutiveList,
  LatestQueue,
  PartitionedQueue,
  PerfectMap,
  ProcessableMessage,
  jitter,
} from '../subscription/util'
import IndexerContext from './context'

export const INDEXER_SUB_ID = 1000 // @TODO same as ingester, needs to be per partition

export class IndexerSubscription {
  leader = new Leader(this.subLockId, this.ctx.db)
  destroyed = false
  repoQueue = new PartitionedQueue({ concurrency: this.concurrency })
  partitions: PerfectMap<number, Partition> = new PerfectMap()
  indexingSvc: IndexingService

  constructor(
    public ctx: IndexerContext,
    public partitionIds: number[],
    public subLockId = INDEXER_SUB_ID,
    public concurrency = Infinity,
  ) {
    this.indexingSvc = ctx.services.indexing(ctx.db)
  }

  async processEvents(opts: { signal: AbortSignal }) {
    const done = () => this.destroyed || opts.signal.aborted
    while (!done()) {
      const results = await this.ctx.redis.xreadBuffer(
        'COUNT',
        50, // events per stream
        'BLOCK',
        1000, // millis
        'STREAMS',
        ...this.partitionIds.map(partitionKey),
        ...this.partitionIds.map((id) => this.partitions.get(id).cursor),
      )
      for (const [key, messages] of results ?? []) {
        if (done()) break
        const partition = this.partitions.get(partitionId(key.toString()))
        for (const [seqBuf, values] of messages) {
          if (done()) break
          const seq = strToInt(seqBuf.toString())
          const envelope = getEnvelope(values)
          partition.cursor = seq
          const item = partition.consecutive.push(seq)
          this.repoQueue.add(envelope.repo, async () => {
            await this.handleMessage(partition, item, envelope)
          })
        }
      }
      await this.repoQueue.main.onEmpty() // backpressure
    }
  }

  async run() {
    while (!this.destroyed) {
      try {
        const { ran } = await this.leader.run(async ({ signal }) => {
          // initialize cursors
          const cursorResults = await this.ctx.redis.mget(
            this.partitionIds.map(cursorKey),
          )
          cursorResults.forEach((cursorStr, i) => {
            const id = this.partitionIds[i]
            const cursor = cursorStr === null ? 0 : strToInt(cursorStr)
            this.partitions.set(id, new Partition(id, cursor))
          })
          // process events
          await this.processEvents({ signal })
        })
        if (ran && !this.destroyed) {
          throw new Error('Indexer sub completed, but should be persistent')
        }
      } catch (err) {
        subLogger.error({ err }, 'indexer subscription error')
      }
      if (!this.destroyed) {
        await wait(5000 + jitter(1000)) // wait then try to become leader
      }
    }
  }

  async destroy() {
    this.destroyed = true
    await this.repoQueue.destroy()
    await Promise.all(
      [...this.partitions.values()].map((p) => p.cursorQueue.destroy()),
    )
    this.leader.destroy(new DisconnectError())
  }

  async resume() {
    this.destroyed = false
    this.partitions = new Map()
    this.repoQueue = new PartitionedQueue({ concurrency: this.concurrency })
    await this.run()
  }

  private async handleMessage(
    partition: Partition,
    item: ConsecutiveItem<number>,
    envelope: Envelope,
  ) {
    try {
      const msg = envelope.event
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
    } catch (err) {
      // We log messages we can't process and move on:
      // otherwise the cursor would get stuck on a poison message.
      subLogger.error({ err }, 'indexer subscription message processing error') // @TODO add back { message: loggableMessage(msg) }
    } finally {
      const latest = item.complete().at(-1)
      if (latest) {
        partition.cursorQueue
          .add(async () => {
            await this.ctx.redis
              .multi() // transactional
              .set(partition.cursorKey, latest) // @TODO can we remove cursor, and just use first item in the queue?
              .xtrim(partition.key, 'MINID', latest)
              .exec()
          })
          .catch((err) => {
            subLogger.error({ err }, 'indexer subscription cursor error')
          })
      }
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
}

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

function getEnvelope(raw: Buffer[]): Envelope {
  const [repoKey, repoVal, eventKey, eventVal] = raw
  assert(repoKey.toString() === 'repo')
  assert(eventKey.toString() === 'event')
  return {
    repo: repoVal.toString(),
    event: cborDecode(eventVal) as ProcessableMessage,
  }
}

type Envelope = {
  repo: string
  event: ProcessableMessage
}

class Partition {
  consecutive = new ConsecutiveList<number>()
  cursorQueue = new LatestQueue()
  constructor(public id: number, public cursor: number) {}
  get key() {
    return partitionKey(this.id)
  }
  get cursorKey() {
    return cursorKey(this.id)
  }
}

function partitionId(key: string) {
  assert(key.startsWith('repo:'))
  return strToInt(key.replace('repo:', ''))
}

function partitionKey(p: number) {
  return `repo:${p}`
}

function cursorKey(p: number) {
  return `repo:${p}:cursor`
}

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

function strToInt(str: string) {
  const int = parseInt(str, 10)
  assert(!isNaN(int), 'string could not be parsed to an integer')
  return int
}
