import assert from 'node:assert'
import { Counter, Registry } from 'prom-client'
import { lexToJson } from '@atproto/api'
import {
  CommitEvt as SyncCommitEvt,
  parseCommitUnauthenticated,
} from '@atproto/sync'
import { Subscription } from '@atproto/xrpc-server'
import { ids } from '../../../lexicon/lexicons'
import {
  Account as AccountEvent,
  Commit as CommitEvent,
  Identity as IdentityEvent,
  isAccount as isAccountEvent,
  isCommit as isCommitEvent,
  isIdentity as isIdentityEvent,
} from '../../../lexicon/types/com/atproto/sync/subscribeRepos'
import { dataplaneLogger as logger } from '../../../logger'
import { FirehoseEvent, StreamEvent } from '../types'
import { Batcher } from './batcher'
import { IngesterOptions } from './types'
import { cursorFor, streamLengthBackpressure } from './util'

export class FirehoseIngester {
  started = false
  ac = new AbortController()
  batcher: Batcher<FirehoseEvent>
  metrics: ReturnType<typeof FirehoseIngester.metrics.labels>
  constructor(private opts: IngesterOptions) {
    this.batcher = new Batcher<FirehoseEvent>({
      process: (events) => this.process(events),
      backpressure: streamLengthBackpressure(opts),
    })
    this.metrics = FirehoseIngester.metrics.labels({
      stream: this.opts.stream,
      host: this.opts.host,
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
        if (isCommitEvent(obj)) return obj as CommitEvent
        if (isAccountEvent(obj)) return obj as AccountEvent
        if (isIdentityEvent(obj)) return obj as IdentityEvent
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
      name: 'firehose_ingester_incoming_events_total',
      help: 'total ingested firehose events',
      labelNames: ['stream', 'host'],
    }),
    streamEvent: new Counter({
      name: 'firehose_ingester_stream_events_total',
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

async function firehoseToStreamEvents(
  evt: FirehoseEvent,
): Promise<StreamEvent[]> {
  if (isCommitEvent(evt)) {
    const ops = await parseCommitUnauthenticated(evt as any).catch((err) => {
      logger.warn(
        {
          err,
          repo: evt.repo,
          rev: evt.rev,
          seq: evt.seq,
          time: evt.time,
          ops: evt.ops,
        },
        'commit event skipped by ingester',
      )
      return [] as SyncCommitEvt[]
    })
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
