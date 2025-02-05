import assert from 'node:assert'
import { Subscription } from '@atproto/xrpc-server'
import { ids } from '../../../lexicon/lexicons'
import {
  Commit as CommitEvent,
  isCommit as isCommitEvent,
  Account as AccountEvent,
  isAccount as isAccountEvent,
  Identity as IdentityEvent,
  isIdentity as isIdentityEvent,
} from '../../../lexicon/types/com/atproto/sync/subscribeRepos'
import { OutputSchema as ListReposOutput } from '@atproto/api/dist/client/types/com/atproto/sync/listRepos'
import { Redis } from '../../../redis'
import { Batcher } from './batcher'
import { streamLengthBackpressure, cursorFor, wait } from './util'
import { Agent } from '@atproto/api'
import { dataplaneLogger as logger } from '../../../logger'

export type IngesterOptions = {
  host: string
  redis: Redis
  stream: string
  highWaterMark?: number
}

type SubscriptionEvent = CommitEvent | AccountEvent | IdentityEvent

export class FirehoseIngester {
  started = false
  ac = new AbortController()
  batcher: Batcher<SubscriptionEvent>
  constructor(private opts: IngesterOptions) {
    this.batcher = new Batcher<SubscriptionEvent>({
      process: (events) => this.process(events),
      backpressure: streamLengthBackpressure(opts),
    })
  }
  async run() {
    assert(!this.started, 'ingester must not be started')
    this.started = true
    ;(async () => {
      while (!this.ac.signal.aborted) {
        await this.subscribe().catch((err) => {
          if (err instanceof DOMException) return
          logger.error({ err }, 'firehose subscription failed')
        })
      }
    })()
  }
  private async subscribe() {
    const sub = new Subscription<SubscriptionEvent>({
      signal: this.ac.signal,
      method: ids.ComAtprotoSyncSubscribeRepos,
      service: this.opts.host.replace(/^http/, 'ws'),
      validate(obj) {
        // consider full validation
        if (isCommitEvent(obj)) return obj
        if (isAccountEvent(obj)) return obj
        if (isIdentityEvent(obj)) return obj
      },
      getParams: async () => {
        const cursor = await this.opts.redis.get(cursorFor(this.opts.stream))
        if (cursor === null) return // pickup from live
        return { cursor }
      },
    })
    for await (const event of sub) {
      await this.batcher.add(event)
    }
  }
  private async process(events: SubscriptionEvent[]) {
    await this.opts.redis.addMultiToStream(
      events.map((event) => ({
        id: '*',
        key: this.opts.stream,
        fields: Object.entries({
          event: JSON.stringify(event),
        }),
      })),
    )
    const last = events.at(-1)
    if (last) {
      await this.opts.redis.set(cursorFor(this.opts.stream), last.seq)
    }
  }
  async stop() {
    this.ac.abort()
    await this.batcher.stop()
  }
}

const CURSOR_DONE = '!ingester-done'

export class BackfillIngester {
  started = false
  ac = new AbortController()
  running: Promise<void> | null = null
  agent: Agent
  constructor(private opts: IngesterOptions) {
    this.agent = new Agent(opts.host)
  }
  run() {
    assert(!this.running, 'ingester must not be started')
    const backpressure = streamLengthBackpressure(this.opts)
    this.running = (async () => {
      let cursor =
        (await this.opts.redis.get(cursorFor(this.opts.stream))) ?? undefined
      while (cursor !== CURSOR_DONE) {
        await backpressure(this.ac.signal)
        if (this.ac.signal.aborted) return
        let result: ListReposOutput
        try {
          const listRepos = await this.agent.com.atproto.sync.listRepos({
            cursor,
            limit: 1000,
          })
          result = listRepos.data
        } catch (err) {
          logger.error({ err }, 'backfill list repos failed')
          await wait(5000, this.ac.signal)
          continue
        }
        if (result.repos.length) {
          await this.opts.redis.addMultiToStream(
            result.repos.map((repo) => ({
              id: '*',
              key: this.opts.stream,
              fields: Object.entries({
                repo: JSON.stringify({
                  did: repo.did,
                  rev: repo.rev,
                  status: repo.status,
                  active: repo.active,
                }),
              }),
            })),
          )
        }
        cursor = result.cursor ?? CURSOR_DONE
        await this.opts.redis.set(cursorFor(this.opts.stream), cursor)
      }
      this.running = null
    })()
  }
  async stop() {
    this.ac.abort()
    await this.running
  }
}
