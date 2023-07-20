import { cborEncode, wait } from '@atproto/common'
import { DisconnectError, Subscription } from '@atproto/xrpc-server'
import { OutputSchema as Message } from '../lexicon/types/com/atproto/sync/subscribeRepos'
import * as message from '../lexicon/types/com/atproto/sync/subscribeRepos'
import { ids, lexicons } from '../lexicon/lexicons'
import { Leader } from '../db/leader'
import { subLogger } from '../logger'
import { LatestQueue } from '../subscription/util'
import { IngesterContext } from './context'

const METHOD = ids.ComAtprotoSyncSubscribeRepos
export const INGESTER_SUB_ID = 1000

export class IngesterSubscription {
  leader = new Leader(this.subLockId, this.ctx.db)
  cursorQueue = new LatestQueue()
  destroyed = false
  lastSeq: number | undefined
  lastCursor: number | undefined

  constructor(
    public ctx: IngesterContext,
    public service: string,
    public subLockId = INGESTER_SUB_ID,
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
      const { seq, repo } = details
      this.lastSeq = seq
      await this.ctx.redis.xadd(
        getPartition(repo),
        seq,
        'repo',
        repo,
        'event',
        ui8ToBuffer(cborEncode(msg)),
      )
      this.cursorQueue.add(() => this.setState({ cursor: seq }))
      // @TODO backpressure
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

  async getState(): Promise<State> {
    const serialized = await this.ctx.redis.get('state')
    const state = serialized ? (JSON.parse(serialized) as State) : { cursor: 0 }
    return state
  }

  async resetState(): Promise<void> {
    await this.ctx.redis.del('state')
  }

  private async setState(state: State): Promise<void> {
    await this.ctx.redis.set('state', JSON.stringify(state))
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
}

// These are the message types that have a sequence number and a repo
type ProcessableMessage =
  | message.Commit
  | message.Handle
  | message.Migrate
  | message.Tombstone

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

// @TODO map did to 1 of N partitions
function getPartition(_did: string) {
  return 'repo:0'
}

type State = { cursor: number }
