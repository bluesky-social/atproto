import { cborEncode, wait } from '@atproto/common'
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
export const INGESTER_SUB_ID = 1000
export const DEFAULT_PARTITION_COUNT = 64

export class IngesterSubscription {
  leader = new Leader(this.subLockId, this.ctx.db)
  cursorQueue = new LatestQueue()
  destroyed = false
  lastSeq: number | undefined
  lastCursor: number | undefined

  constructor(
    public ctx: IngesterContext,
    public service: string,
    public namespace?: string,
    public subLockId = INGESTER_SUB_ID,
    public partitionCount = DEFAULT_PARTITION_COUNT,
  ) {}

  async processSubscription(sub: Subscription<Message>) {
    for await (const msg of sub) {
      const details = getMessageDetails(msg)
      if ('info' in details) {
        // These messages are not sequenced, we just log them and carry on
        subLogger.warn(
          { provider: this.service, message: loggableMessage(msg) },
          `ingester subscription ${details.info ? 'info' : 'unknown'} message`,
        )
        continue
      }
      const { seq, repo, message: processableMessage } = details
      this.lastSeq = seq
      const partitionKey = await getPartition(repo, this.partitionCount)
      // @TODO handle case that event has already been added
      await this.ctx.redis.xadd(
        this.ns(partitionKey),
        seq,
        'repo',
        repo,
        'event',
        ui8ToBuffer(cborEncode(processableMessage)),
      )
      this.cursorQueue.add(() => this.setCursor(seq))
      // @TODO backpressure?
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
          { err, provider: this.service },
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
    const val = await this.ctx.redis.get(this.ns(CURSOR_KEY))
    const state = val !== null ? strToInt(val) : 0
    return state
  }

  async resetCursor(): Promise<void> {
    await this.ctx.redis.del(this.ns(CURSOR_KEY))
  }

  private async setCursor(seq: number): Promise<void> {
    await this.ctx.redis.set(this.ns(CURSOR_KEY), seq)
  }

  private getSubscription(opts: { signal: AbortSignal }) {
    return new Subscription({
      service: this.service,
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
              provider: this.service,
            },
            'ingester subscription skipped invalid message',
          )
        }
      },
    })
  }

  // namespace redis keys
  ns(key: string) {
    return this.namespace ? `${this.namespace}:${key}` : key
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

function ui8ToBuffer(bytes: Uint8Array) {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

async function getPartition(did: string, n: number) {
  const partition = await randomIntFromSeed(did, n)
  return `repo:${partition}`
}

type State = { cursor: number }
