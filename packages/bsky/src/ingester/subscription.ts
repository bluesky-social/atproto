import { ReplyError } from 'ioredis'
import { cborEncode, ui8ToBuffer, wait } from '@atproto/common'
import { randomIntFromSeed } from '@atproto/crypto'
import { DisconnectError, Subscription } from '@atproto/xrpc-server'
import { OutputSchema as Message } from '../lexicon/types/com/atproto/sync/subscribeRepos'
import * as message from '../lexicon/types/com/atproto/sync/subscribeRepos'
import { ids, lexicons } from '../lexicon/lexicons'
import { Leader } from '../db/leader'
import { subLogger } from '../logger'
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

  constructor(
    public ctx: IngesterContext,
    public opts: {
      service: string
      partitionCount: number
      maxItems?: number
      checkItemsEveryN?: number
      subLockId?: number
    },
  ) {}

  async processSubscription(sub: Subscription<Message>) {
    for await (const msg of sub) {
      const details = getMessageDetails(msg)
      if ('info' in details) {
        // These messages are not sequenced, we just log them and carry on
        subLogger.warn(
          { provider: this.opts.service, message: loggableMessage(msg) },
          `ingester subscription ${details.info ? 'info' : 'unknown'} message`,
        )
        continue
      }
      const { seq, repo, message: processableMessage } = details
      const partitionKey = await getPartition(repo, this.opts.partitionCount)
      try {
        await this.ctx.redis.addToStream(partitionKey, seq, [
          ['repo', repo],
          ['event', ui8ToBuffer(cborEncode(processableMessage))],
        ])
        this.lastSeq = seq
      } catch (err) {
        if (err instanceof ReplyError) {
          // skipping over entries that have already been added or fully processed
          subLogger.warn({ seq, repo }, 'ingester subscription skipping entry')
        } else {
          throw err
        }
      }
      this.cursorQueue.add(() => this.setCursor(seq))
      await this.backpressure.ready()
    }
  }

  async run() {
    while (!this.destroyed) {
      try {
        const { ran } = await this.leader.run(async ({ signal }) => {
          const sub = this.getSubscription({ signal })
          await this.processSubscription(sub)
        })
        if (ran && !this.destroyed) {
          throw new Error('Ingester sub completed, but should be persistent')
        }
      } catch (err) {
        subLogger.error(
          { err, provider: this.opts.service },
          'ingester subscription error',
        )
      }
      if (!this.destroyed) {
        await wait(1000 + jitter(500)) // wait then try to become leader
      }
    }
  }

  async destroy() {
    this.destroyed = true
    await this.cursorQueue.destroy()
    this.leader.destroy(new DisconnectError())
  }

  async resume() {
    this.destroyed = false
    this.cursorQueue = new LatestQueue()
    await this.run()
  }

  async getCursor(): Promise<number> {
    const val = await this.ctx.redis.get(CURSOR_KEY)
    const state = val !== null ? strToInt(val) : 0
    return state
  }

  async resetCursor(): Promise<void> {
    await this.ctx.redis.del(CURSOR_KEY)
  }

  private async setCursor(seq: number): Promise<void> {
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
        subLogger.warn(
          { err, reconnects, initial },
          'ingester subscription reconnect',
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
              provider: this.opts.service,
            },
            'ingester subscription skipped invalid message',
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

class Backpressure {
  count = 0
  lastTotal = 0
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
        subLogger.warn(
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
