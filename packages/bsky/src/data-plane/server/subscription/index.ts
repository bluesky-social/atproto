import assert from 'node:assert'
import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { Subscription } from '@atproto/xrpc-server'
import { cborDecode, handleAllSettledErrors } from '@atproto/common'
import { ValidationError } from '@atproto/lexicon'
import { IdResolver } from '@atproto/identity'
import {
  WriteOpAction,
  readCarWithRoot,
  cborToLexRecord,
  def,
  Commit,
} from '@atproto/repo'
import { ids, lexicons } from '../../../lexicon/lexicons'
import { OutputSchema as Message } from '../../../lexicon/types/com/atproto/sync/subscribeRepos'
import * as message from '../../../lexicon/types/com/atproto/sync/subscribeRepos'
import { subLogger as log } from '../../../logger'
import { IndexingService } from '../indexing'
import { Database } from '../db'
import {
  ConsecutiveItem,
  ConsecutiveList,
  PartitionedQueue,
  ProcessableMessage,
  loggableMessage,
} from './util'
import { BackgroundQueue } from '../background'

export class RepoSubscription {
  ac = new AbortController()
  running: Promise<void> | undefined
  cursor = 0
  seenSeq: number | null = null
  repoQueue = new PartitionedQueue({ concurrency: Infinity })
  consecutive = new ConsecutiveList<number>()
  background: BackgroundQueue
  indexingSvc: IndexingService

  constructor(
    private opts: {
      service: string
      db: Database
      idResolver: IdResolver
      background: BackgroundQueue
    },
  ) {
    this.background = new BackgroundQueue(this.opts.db)
    this.indexingSvc = new IndexingService(
      this.opts.db,
      this.opts.idResolver,
      this.background,
    )
  }

  run() {
    if (this.running) return
    this.ac = new AbortController()
    this.repoQueue = new PartitionedQueue({ concurrency: Infinity })
    this.consecutive = new ConsecutiveList<number>()
    this.running = this.process()
      .catch((err) => {
        if (err.name !== 'AbortError') {
          // allow this to cause an unhandled rejection, let deployment handle the crash.
          log.error({ err }, 'subscription crashed')
          throw err
        }
      })
      .finally(() => (this.running = undefined))
  }

  private async process() {
    const sub = this.getSubscription()
    for await (const msg of sub) {
      const details = getMessageDetails(msg)
      if ('info' in details) {
        // These messages are not sequenced, we just log them and carry on
        log.warn(
          { provider: this.opts.service, message: loggableMessage(msg) },
          `sub ${details.info ? 'info' : 'unknown'} message`,
        )
        continue
      }
      const item = this.consecutive.push(details.seq)
      this.repoQueue.add(details.repo, async () => {
        await this.handleMessage(item, details)
      })
      this.seenSeq = details.seq
      await this.repoQueue.main.onEmpty() // backpressure
    }
  }

  private async handleMessage(
    item: ConsecutiveItem<number>,
    envelope: Envelope,
  ) {
    const msg = envelope.message
    try {
      if (message.isCommit(msg)) {
        await this.handleCommit(msg)
      } else if (message.isHandle(msg)) {
        await this.handleUpdateHandle(msg)
      } else if (message.isIdentity(msg)) {
        await this.handleIdentityEvt(msg)
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
      log.error(
        { err, message: loggableMessage(msg) },
        'indexer message processing error',
      )
    } finally {
      const latest = item.complete().at(-1)
      if (latest !== undefined) {
        this.cursor = latest
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
        const needsReindex =
          await this.indexingSvc.checkCommitNeedsIndexing(root)
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
              log.warn(
                {
                  did: msg.repo,
                  commit: msg.commit.toString(),
                  uri: op.uri.toString(),
                  cid: op.cid.toString(),
                },
                'skipping indexing of invalid record',
              )
            } else {
              log.error(
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

  private async handleIdentityEvt(msg: message.Identity) {
    await this.indexingSvc.indexHandle(msg.did, msg.time, true)
  }

  private async handleTombstone(msg: message.Tombstone) {
    await this.indexingSvc.tombstoneActor(msg.did)
  }

  private getSubscription() {
    return new Subscription({
      service: this.opts.service,
      method: ids.ComAtprotoSyncSubscribeRepos,
      signal: this.ac.signal,
      getParams: async () => {
        return { cursor: this.cursor }
      },
      onReconnectError: (err, reconnects, initial) => {
        log.warn({ err, reconnects, initial }, 'sub reconnect')
      },
      validate: (value) => {
        try {
          return lexicons.assertValidXrpcMessage<Message>(
            ids.ComAtprotoSyncSubscribeRepos,
            value,
          )
        } catch (err) {
          log.warn(
            {
              err,
              seq: ifNumber(value?.['seq']),
              repo: ifString(value?.['repo']),
              commit: ifString(value?.['commit']?.toString()),
              time: ifString(value?.['time']),
              provider: this.opts.service,
            },
            'ingester sub skipped invalid message',
          )
        }
      },
    })
  }

  async destroy() {
    this.ac.abort()
    await this.running
    await this.repoQueue.destroy()
    await this.background.processAll()
  }
}

type Envelope = {
  repo: string
  message: ProcessableMessage
}

function ifString(val: unknown): string | undefined {
  return typeof val === 'string' ? val : undefined
}

function ifNumber(val: unknown): number | undefined {
  return typeof val === 'number' ? val : undefined
}

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
  } else if (message.isIdentity(msg)) {
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
