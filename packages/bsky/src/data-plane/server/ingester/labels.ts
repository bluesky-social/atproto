import assert from 'node:assert'
import { Counter, Registry } from 'prom-client'
import { Subscription } from '@atproto/xrpc-server'
import { ids } from '../../../lexicon/lexicons'
import {
  Info as LabelInfoEvent,
  Labels as LabelsEvent,
  isInfo as isLabelInfoEvent,
  isLabels as isLabelsEvent,
} from '../../../lexicon/types/com/atproto/label/subscribeLabels'
import { dataplaneLogger as logger } from '../../../logger'
import { LabelStreamEvent, LabelerEvent } from '../types'
import { Batcher } from './batcher'
import { IngesterOptions } from './types'
import { cursorFor, streamLengthBackpressure } from './util'

export class LabelerIngester {
  started = false
  ac = new AbortController()
  batcher: Batcher<LabelerEvent>
  metrics: ReturnType<typeof LabelerIngester.metrics.labels>
  constructor(private opts: IngesterOptions) {
    this.batcher = new Batcher<LabelerEvent>({
      process: (events) => this.process(events),
      backpressure: streamLengthBackpressure(opts),
    })
    this.metrics = LabelerIngester.metrics.labels({
      stream: this.opts.stream,
      host: this.opts.host,
    })
  }
  run() {
    assert(!this.started, 'label ingester must not be started')
    this.started = true
    ;(async () => {
      while (!this.ac.signal.aborted) {
        await this.subscribe().catch((err) => {
          if (err instanceof DOMException) return
          logger.error({ err }, 'labeler subscription failed')
        })
      }
    })()
  }
  private async subscribe() {
    const sub = new Subscription<LabelerEvent>({
      signal: this.ac.signal,
      method: ids.ComAtprotoLabelSubscribeLabels,
      service: this.opts.host.replace(/^http/, 'ws'),
      validate(obj) {
        // consider full validation
        if (isLabelsEvent(obj)) return obj as LabelsEvent
        if (isLabelInfoEvent(obj)) return obj as LabelInfoEvent
      },
      getParams: async () => {
        const cursor = await this.opts.redis.get(cursorFor(this.opts))
        if (cursor === null) return { cursor: '0' } // pickup from the beginning
        return { cursor }
      },
    })
    for await (const event of sub) {
      await this.batcher.add(event)
    }
  }
  private async process(labelerEvents: LabelerEvent[]) {
    let last: LabelsEvent | undefined
    for (const evt of labelerEvents) {
      if (isLabelsEvent(evt)) {
        last = evt
      }
      if (isLabelInfoEvent(evt)) {
        logger.warn(
          { name: evt.name, message: evt.message },
          'labeler info event',
        )
      }
    }
    const streamEvents: LabelStreamEvent[] = (
      await Promise.all(labelerEvents.map(labelerToStreamEvents))
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
    if (last) {
      await this.opts.redis.set(cursorFor(this.opts), last.seq)
    }
    this.metrics.labelerEvent.inc(labelerEvents.length)
    this.metrics.streamEvent.inc(streamEvents.length)
  }
  async stop() {
    this.ac.abort()
    await this.batcher.stop()
  }
  static metrics = {
    labelerEvent: new Counter({
      name: 'labeler_ingester_incoming_events_total',
      help: 'total ingested labeler events',
      labelNames: ['stream', 'host'],
    }),
    streamEvent: new Counter({
      name: 'labeler_ingester_stream_events_total',
      help: 'total ingested label stream events',
      labelNames: ['stream', 'host'],
    }),
    labels(labels: { stream: string; host: string }) {
      return {
        labelerEvent: this.labelerEvent.labels(labels),
        streamEvent: this.streamEvent.labels(labels),
      }
    },
    register(registry: Registry) {
      registry.registerMetric(this.labelerEvent)
      registry.registerMetric(this.streamEvent)
    },
  }
}

async function labelerToStreamEvents(
  evt: LabelerEvent,
): Promise<LabelStreamEvent[]> {
  if (isLabelsEvent(evt)) {
    return evt.labels.map((label) => ({ type: 'label', label }))
  }
  if (isLabelInfoEvent(evt)) {
    return []
  }
  return []
}
