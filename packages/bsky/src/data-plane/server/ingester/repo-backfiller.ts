import assert from 'node:assert'
import PQueue from 'p-queue'
import { chunkArray } from '@atproto/common'
import { getAndParseRecord, readCarWithRoot, verifyRepo } from '@atproto/repo'
import { dataplaneLogger } from '../../../logger'
import { Redis, StreamOutputMessage } from '../../../redis'
import { BackfillEvent, StreamEvent } from '../types'
import { streamLengthBackpressure } from './util'
// import { Counter, Gauge, Registry } from 'prom-client'

export class RepoBackfiller {
  started = false
  ac = new AbortController()
  queue: PQueue
  // metrics = RepoBackfiller.metrics.labels({
  //   stream: this.opts.stream,
  //   group: this.opts.group,
  //   consumer: this.opts.consumer,
  // })
  backpressure: ReturnType<typeof streamLengthBackpressure>
  constructor(
    private opts: {
      redis: Redis
      streamIn: string
      streamOut: string
      group: string
      consumer: string
      concurrency?: number
    },
  ) {
    this.queue = new PQueue({
      concurrency: opts.concurrency ?? 2,
    })
    this.backpressure = streamLengthBackpressure({
      redis: opts.redis,
      stream: opts.streamOut,
    })
  }
  run() {
    assert(!this.started, 'repo backfiller must not be started')
    this.started = true
    ;(async () => {
      await this.opts.redis.ensureConsumerGroup({
        group: this.opts.group,
        stream: this.opts.streamIn,
      })
      // work through pending starting from 0...
      let cursor = '0'
      while (!this.ac.signal.aborted) {
        if (this.queue.size) {
          await this.queue.onEmpty()
        }
        const messages = await this.opts.redis.readConsumerGroup(
          { cursor, key: this.opts.streamIn },
          { count: 100, group: this.opts.group, consumer: this.opts.consumer },
        )
        if (!this.ac.signal.aborted) {
          // this.metrics.waiting.inc(messages.length)
          this.queue.addAll(
            messages.map((msg) => this.handleMessage.bind(this, msg)),
          )
        }
        if (cursor !== '>') {
          // ...then pick up from live (>)
          cursor = messages.at(-1)?.cursor ?? '>'
        }
      }
    })()
  }
  async process(event: BackfillEvent) {
    const url = new URL('/xrpc/com.atproto.sync.getRepo', event.host)
    url.searchParams.set('did', event.did)
    const res = await fetch(url)
    if (!res.ok) {
      // @TODO retry
      const msg = await res.text()
      throw new Error(`repo fetch failed: ${msg}`)
    }
    const car = Buffer.from(await res.arrayBuffer())
    const { root, blocks } = await readCarWithRoot(car)
    const repo = await verifyRepo(blocks, root, event.did)
    const now = new Date().toISOString()
    for (const chunk of chunkArray(repo.creates, 500)) {
      const streamEvents: StreamEvent[] = await Promise.all(
        chunk.map(async (op) => ({
          type: 'create',
          did: event.did,
          collection: op.collection,
          rkey: op.rkey,
          cid: op.cid.toString(),
          record: (await getAndParseRecord(blocks, op.cid)).record,
          commit: root.toString(),
          rev: repo.commit.rev,
          seq: -1,
          time: now,
        })),
      )
      await this.opts.redis.addMultiToStream(
        streamEvents.map((evt) => ({
          id: '*',
          key: this.opts.streamOut,
          fields: Object.entries({
            event: JSON.stringify(evt),
          }),
        })),
      )
    }
  }
  private async handleMessage(msg: StreamOutputMessage) {
    try {
      // this.metrics.waiting.dec(1)
      // this.metrics.running.inc(1)
      const event =
        typeof msg.contents.repo === 'string'
          ? safeParse<BackfillEvent>(msg.contents.repo)
          : undefined
      if (!event) {
        dataplaneLogger.error(
          { message: msg.contents },
          'skipping bad backfill repo message',
        )
        await this.opts.redis.ackMessage({
          del: true,
          id: msg.cursor,
          group: this.opts.group,
          stream: this.opts.streamIn,
        })
        return
      }
      await this.backpressure(this.ac.signal)
      this.ac.signal.throwIfAborted()
      await this.process(event)
      await this.opts.redis.ackMessage({
        del: true,
        id: msg.cursor,
        group: this.opts.group,
        stream: this.opts.streamIn,
      })
    } catch (err) {
      // message remains pending
      dataplaneLogger.error(
        { err, message: msg.contents },
        'failed backfill repo message',
      )
      // this.metrics.failed.inc(1)
    } finally {
      // this.metrics.running.dec(1)
      // this.metrics.processed.inc(1)
    }
  }
  async stop() {
    this.ac.abort()
    await this.queue.onIdle()
  }
}

function safeParse<T>(val: string) {
  try {
    return JSON.parse(val) as T
  } catch {
    return
  }
}
