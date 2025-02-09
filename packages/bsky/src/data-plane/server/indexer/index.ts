import assert from 'node:assert'
import PQueue from 'p-queue'
import { Counter, Gauge, Histogram, Registry } from 'prom-client'
import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { WriteOpAction } from '@atproto/repo'
import { jsonToLex } from '@atproto/lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Redis, StreamOutputMessage } from '../../../redis'
import { dataplaneLogger } from '../../../logger'
import { StreamEvent } from '../types'
import { IndexingService } from '../indexing'

export class StreamIndexer {
  started = false
  ac = new AbortController()
  queue: PQueue
  metrics = StreamIndexer.metrics.labels({
    stream: this.opts.stream,
    group: this.opts.group,
    consumer: this.opts.consumer,
  })
  constructor(
    private opts: {
      redis: Redis
      stream: string
      group: string
      consumer: string
      concurrency?: number
      indexingService: IndexingService
    },
  ) {
    this.queue = new PQueue({
      concurrency: opts.concurrency ?? 10,
    })
  }
  run() {
    assert(!this.started, 'indexer must not be started')
    this.started = true
    ;(async () => {
      await this.opts.redis.ensureConsumerGroup({
        group: this.opts.group,
        stream: this.opts.stream,
      })
      // work through pending starting from 0...
      let cursor = '0'
      while (!this.ac.signal.aborted) {
        if (this.queue.size) {
          await this.queue.onEmpty()
        }
        const messages = await this.opts.redis.readConsumerGroup(
          { cursor, key: this.opts.stream },
          { count: 100, group: this.opts.group, consumer: this.opts.consumer },
        )
        if (!this.ac.signal.aborted) {
          this.metrics.waiting.inc(messages.length)
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
  private async process(event: StreamEvent) {
    // @TODO index handles, account, and identity events
    const { indexingService } = this.opts
    if (
      event.type === 'create' ||
      event.type === 'update' ||
      event.type === 'delete'
    ) {
      if (event.type === 'create') {
        await indexingService.indexRecord(
          AtUri.make(event.did, event.collection, event.rkey),
          CID.parse(event.cid),
          jsonToLex(event.record),
          WriteOpAction.Create,
          event.time,
          event.rev,
          { disableNotifs: true },
        )
      } else if (event.type === 'update') {
        await indexingService.indexRecord(
          AtUri.make(event.did, event.collection, event.rkey),
          CID.parse(event.cid),
          jsonToLex(event.record),
          WriteOpAction.Update,
          event.time,
          event.rev,
          { disableNotifs: true },
        )
      } else if (event.type === 'delete') {
        await indexingService.deleteRecord(
          AtUri.make(event.did, event.collection, event.rkey),
          event.rev,
        )
      }
      await indexingService.setCommitLastSeen(
        event.did,
        CID.parse(event.commit),
        event.rev,
      )
    }
  }
  private async handleMessage(msg: StreamOutputMessage) {
    try {
      this.metrics.waiting.dec(1)
      this.metrics.running.inc(1)
      const event =
        typeof msg.contents.event === 'string'
          ? safeParse<StreamEvent>(msg.contents.event)
          : undefined
      if (!event) {
        dataplaneLogger.error(
          { message: msg.contents },
          'skipping bad indexer stream message',
        )
        await this.opts.redis.ackMessage({
          del: true,
          id: msg.cursor,
          group: this.opts.group,
          stream: this.opts.stream,
        })
        return
      }
      const startTime = process.hrtime.bigint()
      await this.process(event).catch(ignoreSkipErrors.bind(null, event))
      const endTime = process.hrtime.bigint()
      this.metrics.timing
        .labels({
          ...this.metrics.labels,
          type:
            event.type + ('collection' in event ? `-${event.collection}` : ''),
        })
        .observe(Number(endTime - startTime) / 1e6) // ms
      await this.opts.redis.ackMessage({
        del: true,
        id: msg.cursor,
        group: this.opts.group,
        stream: this.opts.stream,
      })
    } catch (err) {
      // message remains pending
      dataplaneLogger.error(
        { err, message: msg.contents },
        'failed indexer stream message',
      )
      this.metrics.failed.inc(1)
    } finally {
      this.metrics.running.dec(1)
      this.metrics.processed.inc(1)
    }
  }
  async stop() {
    this.ac.abort()
    await this.queue.onIdle()
  }
  static metrics = {
    processed: new Counter({
      name: 'messages_processed_total',
      help: 'total processed stream messages',
      labelNames: ['stream', 'group', 'consumer'],
    }),
    failed: new Counter({
      name: 'messages_failed_total',
      help: 'total failed stream messages',
      labelNames: ['stream', 'group', 'consumer'],
    }),
    waiting: new Gauge({
      name: 'messages_waiting_count',
      help: 'count of waiting stream messages',
      labelNames: ['stream', 'group', 'consumer'],
    }),
    running: new Gauge({
      name: 'messages_running_count',
      help: 'count of running stream messages',
      labelNames: ['stream', 'group', 'consumer'],
    }),
    timing: new Histogram({
      name: 'message_processing_time',
      help: 'time to process each message',
      labelNames: ['stream', 'group', 'consumer', 'type'],
    }),
    labels(labels: { stream: string; group: string; consumer: string }) {
      return {
        labels,
        processed: this.processed.labels(labels),
        failed: this.failed.labels(labels),
        waiting: this.waiting.labels(labels),
        running: this.running.labels(labels),
        timing: this.timing,
      }
    },
    register(registry: Registry) {
      registry.registerMetric(this.processed)
      registry.registerMetric(this.failed)
      registry.registerMetric(this.waiting)
      registry.registerMetric(this.running)
      registry.registerMetric(this.timing)
    },
  }
}

function ignoreSkipErrors(event: StreamEvent, err: unknown) {
  if (err instanceof InvalidRequestError) {
    return dataplaneLogger.warn({ err, event }, 'event skipped by indexer')
  }
  throw err
}

function safeParse<T>(val: string) {
  try {
    return JSON.parse(val) as T
  } catch {
    return
  }
}
