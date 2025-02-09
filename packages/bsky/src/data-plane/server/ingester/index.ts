import assert from 'node:assert'
import { Subscription } from '@atproto/xrpc-server'
import { Agent, lexToJson } from '@atproto/api'
import { parseCommitUnauthenticated } from '@atproto/sync'
import { Counter, Registry } from 'prom-client'
import { ids } from '../../../lexicon/lexicons'
import {
  isCommit as isCommitEvent,
  isAccount as isAccountEvent,
  isIdentity as isIdentityEvent,
} from '../../../lexicon/types/com/atproto/sync/subscribeRepos'
import { OutputSchema as ListReposOutput } from '@atproto/api/dist/client/types/com/atproto/sync/listRepos'
import { Redis } from '../../../redis'
import { Batcher } from './batcher'
import { streamLengthBackpressure, cursorFor, wait } from './util'
import { dataplaneLogger as logger } from '../../../logger'
import { StreamEvent, FirehoseEvent, BackfillEvent } from '../types'

export type IngesterOptions = {
  host: string
  redis: Redis
  stream: string
  highWaterMark?: number
}

export class FirehoseIngester {
  started = false
  ac = new AbortController()
  batcher: Batcher<FirehoseEvent>
  metrics = FirehoseIngester.metrics.labels({
    stream: this.opts.stream,
    host: this.opts.host,
  })
  constructor(private opts: IngesterOptions) {
    this.batcher = new Batcher<FirehoseEvent>({
      process: (events) => this.process(events),
      backpressure: streamLengthBackpressure(opts),
    })
  }
  run() {
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
    const sub = new Subscription<FirehoseEvent>({
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
        const cursor = await this.opts.redis.get(cursorFor(this.opts))
        if (cursor === null) return // pickup from live
        return { cursor }
      },
    })
    for await (const event of sub) {
      await this.batcher.add(event)
    }
  }
  private async process(firehoseEvents: FirehoseEvent[]) {
    const streamEvents: StreamEvent[] = (
      await Promise.all(firehoseEvents.map(firehoseToStreamEvents))
    ).flat()
    await this.opts.redis.addMultiToStream(
      streamEvents.map((evt) => ({
        id: '*',
        key: this.opts.stream,
        fields: Object.entries({
          event: JSON.stringify(evt),
        }),
      })),
    )
    const last = firehoseEvents.at(-1)
    if (last) {
      await this.opts.redis.set(cursorFor(this.opts), last.seq)
    }
    this.metrics.firehoseEvent.inc(firehoseEvents.length)
    this.metrics.streamEvent.inc(streamEvents.length)
  }
  async stop() {
    this.ac.abort()
    await this.batcher.stop()
  }
  static metrics = {
    firehoseEvent: new Counter({
      name: 'firehose_events_total',
      help: 'total ingested firehose events',
      labelNames: ['stream', 'host'],
    }),
    streamEvent: new Counter({
      name: 'stream_events_total',
      help: 'total ingested stream events',
      labelNames: ['stream', 'host'],
    }),
    labels(labels: { stream: string; host: string }) {
      return {
        firehoseEvent: this.firehoseEvent.labels(labels),
        streamEvent: this.streamEvent.labels(labels),
      }
    },
    register(registry: Registry) {
      registry.registerMetric(this.firehoseEvent)
      registry.registerMetric(this.streamEvent)
    },
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
        (await this.opts.redis.get(cursorFor(this.opts))) ?? undefined
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
                  host: this.opts.host,
                  rev: repo.rev,
                  status: repo.status,
                  active: repo.active,
                } satisfies BackfillEvent),
              }),
            })),
          )
        }
        cursor = result.cursor ?? CURSOR_DONE
        await this.opts.redis.set(cursorFor(this.opts), cursor)
      }
      this.running = null
    })()
  }
  async stop() {
    this.ac.abort()
    await this.running
  }
}

async function firehoseToStreamEvents(
  evt: FirehoseEvent,
): Promise<StreamEvent[]> {
  if (isCommitEvent(evt)) {
    const ops = await parseCommitUnauthenticated(evt)
    return ops.map((op) => {
      const base = {
        seq: op.seq,
        time: op.time,
        did: op.did,
        commit: op.commit.toString(),
        rev: op.rev,
        collection: op.collection,
        rkey: op.rkey,
      }
      if (op.event === 'update') {
        return {
          type: 'update',
          record: lexToJson(op.record),
          cid: op.cid.toString(),
          ...base,
        }
      } else if (op.event === 'create') {
        return {
          type: 'create',
          record: lexToJson(op.record),
          cid: op.cid.toString(),
          ...base,
        }
      } else if (op.event === 'delete') {
        return { type: 'delete', ...base }
      } else {
        const exhaustiveCheck: never = op['event']
        assert.fail(`unknown event: ${exhaustiveCheck}`)
      }
    })
  }
  if (isAccountEvent(evt)) {
    return [
      {
        type: 'account',
        seq: evt.seq,
        time: evt.time,
        did: evt.did,
        active: evt.active,
        status: evt.status,
      },
    ]
  }
  if (isIdentityEvent(evt)) {
    return [
      {
        type: 'identity',
        seq: evt.seq,
        time: evt.time,
        did: evt.did,
        handle: evt.handle,
      },
    ]
  }
  return []
}
