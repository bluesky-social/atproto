import {
  Deferrable,
  cborEncode,
  createDeferrable,
  ui8ToBuffer,
  wait,
} from '@atproto/common'
import { randomIntFromSeed } from '@atproto/crypto'
import { DisconnectError, Subscription } from '@atproto/xrpc-server'
import { OutputSchema as Message } from '../lexicon/types/com/atproto/sync/subscribeRepos'
import * as message from '../lexicon/types/com/atproto/sync/subscribeRepos'
import { ids, lexicons } from '../lexicon/lexicons'
import { Leader } from '../db/leader'
import log from './logger'
import {
  LatestQueue,
  ProcessableMessage,
  loggableMessage,
  jitter,
  strToInt,
} from '../subscription/util'
import { IngesterContext } from './context'

const METHOD = ids.ComAtprotoSyncSubscribeRepos
const CURSOR_KEY = 'ingester:cursor'
export const INGESTER_SUB_LOCK_ID = 1000

export class IngesterSubscription {
  cursorQueue = new LatestQueue()
  destroyed = false
  lastSeq: number | undefined
  backpressure = new Backpressure(this)
  leader = new Leader(this.opts.subLockId || INGESTER_SUB_LOCK_ID, this.ctx.db)
  processor = new Processor(this)

  constructor(
    public ctx: IngesterContext,
    public opts: {
      service: string
      partitionCount: number
      maxItems?: number
      checkItemsEveryN?: number
      subLockId?: number
      initialCursor?: number
    },
  ) {}

  async run() {
    while (!this.destroyed) {
      try {
        const { ran } = await this.leader.run(async ({ signal }) => {
          const sub = this.getSubscription({ signal })
          for await (const msg of sub) {
            const details = getMessageDetails(msg)
            if ('info' in details) {
              // These messages are not sequenced, we just log them and carry on
              log.warn(
                { provider: this.opts.service, message: loggableMessage(msg) },
                `ingester sub ${details.info ? 'info' : 'unknown'} message`,
              )
              continue
            }
            this.processor.send(details)
            await this.backpressure.ready()
          }
        })
        if (ran && !this.destroyed) {
          throw new Error('Ingester sub completed, but should be persistent')
        }
      } catch (err) {
        log.error({ err, provider: this.opts.service }, 'ingester sub error')
      }
      if (!this.destroyed) {
        await wait(1000 + jitter(500)) // wait then try to become leader
      }
    }
  }

  async destroy() {
    this.destroyed = true
    await this.processor.destroy()
    await this.cursorQueue.destroy()
    this.leader.destroy(new DisconnectError())
  }

  async resume() {
    this.destroyed = false
    this.processor = new Processor(this)
    this.cursorQueue = new LatestQueue()
    await this.run()
  }

  async getCursor(): Promise<number> {
    const val = await this.ctx.redis.get(CURSOR_KEY)
    const initialCursor = this.opts.initialCursor ?? 0
    return val !== null ? strToInt(val) : initialCursor
  }

  async resetCursor(): Promise<void> {
    await this.ctx.redis.del(CURSOR_KEY)
  }

  async setCursor(seq: number): Promise<void> {
    await this.ctx.redis.set(CURSOR_KEY, seq)
  }

  private getSubscription(opts: { signal: AbortSignal }) {
    return new Subscription({
      service: this.opts.service,
      method: METHOD,
      signal: opts.signal,
      getParams: async () => {
        const cursor = await this.getCursor()
        return { cursor }
      },
      onReconnectError: (err, reconnects, initial) => {
        log.warn({ err, reconnects, initial }, 'ingester sub reconnect')
      },
      validate: (value) => {
        try {
          return lexicons.assertValidXrpcMessage<Message>(METHOD, value)
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
  } else if (message.isMigrate(msg)) {
    return { seq: msg.seq, repo: msg.did, message: msg }
  } else if (message.isTombstone(msg)) {
    return { seq: msg.seq, repo: msg.did, message: msg }
  } else if (message.isInfo(msg)) {
    return { info: msg }
  }
  return { info: null }
}

async function getPartition(did: string, n: number) {
  const partition = await randomIntFromSeed(did, n)
  return `repo:${partition}`
}

class Processor {
  running: Deferrable | null = null
  destroyed = false
  unprocessed: MessageEnvelope[] = []

  constructor(public sub: IngesterSubscription) {}

  async handleBatch(batch: MessageEnvelope[]) {
    if (!batch.length) return
    const items = await Promise.all(
      batch.map(async ({ seq, repo, message }) => {
        const key = await getPartition(repo, this.sub.opts.partitionCount)
        const fields: [string, string | Buffer][] = [
          ['repo', repo],
          ['event', ui8ToBuffer(cborEncode(message))],
        ]
        return { key, id: seq, fields }
      }),
    )
    const results = await this.sub.ctx.redis.addMultiToStream(items)
    results.forEach(([err], i) => {
      if (err) {
        // skipping over messages that have already been added or fully processed
        const item = batch.at(i)
        log.warn(
          { seq: item?.seq, repo: item?.repo },
          'ingester skipping message',
        )
      }
    })
    const lastSeq = batch[batch.length - 1].seq
    this.sub.lastSeq = lastSeq
    this.sub.cursorQueue.add(() => this.sub.setCursor(lastSeq))
  }

  async process() {
    if (this.running || this.destroyed || !this.unprocessed.length) return
    const next = this.unprocessed.splice(100) // pipeline no more than 100
    const processing = this.unprocessed
    this.unprocessed = next
    this.running = createDeferrable()
    try {
      await this.handleBatch(processing)
    } catch (err) {
      log.error(
        { err, size: processing.length },
        'ingester processing failed, rolling over to next batch',
      )
      this.unprocessed.unshift(...processing)
    } finally {
      this.running.resolve()
      this.running = null
      this.process()
    }
  }

  send(envelope: MessageEnvelope) {
    this.unprocessed.push(envelope)
    this.process()
  }

  async destroy() {
    this.destroyed = true
    this.unprocessed = []
    await this.running?.complete
  }
}

type MessageEnvelope = {
  seq: number
  repo: string
  message: ProcessableMessage
}

class Backpressure {
  count = 0
  lastTotal: number | null = null
  partitionCount = this.sub.opts.partitionCount
  limit = this.sub.opts.maxItems ?? Infinity
  checkEvery = this.sub.opts.checkItemsEveryN ?? 500

  constructor(public sub: IngesterSubscription) {}

  async ready() {
    this.count++
    const shouldCheck =
      this.limit !== Infinity &&
      (this.count === 1 || this.count % this.checkEvery === 0)
    if (!shouldCheck) return
    let ready = false
    const start = Date.now()
    while (!ready) {
      ready = await this.check()
      if (!ready) {
        log.warn(
          {
            limit: this.limit,
            total: this.lastTotal,
            duration: Date.now() - start,
          },
          'ingester backpressure',
        )
        await wait(250)
      }
    }
  }

  async check() {
    const lens = await this.sub.ctx.redis.streamLengths(
      [...Array(this.partitionCount)].map((_, i) => `repo:${i}`),
    )
    this.lastTotal = lens.reduce((sum, len) => sum + len, 0)
    return this.lastTotal < this.limit
  }
}
