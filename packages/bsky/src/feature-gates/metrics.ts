import { featureGatesLogger } from '../logger'

type Events = {
  'experiment:viewed': {
    experimentId: string
    variationId: string
  }
  'feature:viewed': {
    featureId: string
    featureResultValue: unknown
    /** Only available if feature has experiment rules applied */
    experimentId?: string
    /** Only available if feature has experiment rules applied */
    variationId?: string
  }
}

type Event<M extends Record<string, any>> = {
  time: number
  event: keyof M
  payload: M[keyof M]
  metadata: Record<string, any>
}

export type Config = {
  trackingEndpoint?: string
}

export class MetricsClient<M extends Record<string, any> = Events> {
  maxBatchSize = 100

  private started: boolean = false
  private queue: Event<M>[] = []
  private flushInterval: NodeJS.Timeout | null = null
  constructor(private config: Config) {}

  start() {
    if (this.started) return
    this.started = true
    this.flushInterval = setInterval(() => {
      this.flush()
    }, 10_000)
  }

  stop() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }
    this.flush()
  }

  track<E extends keyof M>(
    event: E,
    payload: M[E],
    metadata: Record<string, any> = {},
  ) {
    this.start()

    const e = {
      source: 'appview',
      time: Date.now(),
      event,
      payload,
      metadata,
    }
    this.queue.push(e)

    if (this.queue.length > this.maxBatchSize) {
      this.flush()
    }
  }

  flush() {
    if (!this.queue.length) return
    const events = this.queue.splice(0, this.queue.length)
    this.sendBatch(events)
  }

  private async sendBatch(events: Event<M>[]) {
    if (!this.config.trackingEndpoint) return

    try {
      const res = await fetch(this.config.trackingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
        keepalive: true,
      })

      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown error')
        featureGatesLogger.error(
          { err: new Error(`${res.status} Failed to fetch - ${errorText}`) },
          'Failed to send metrics',
        )
      } else {
        // Drain response body to allow connection reuse.
        await res.text().catch(() => {})
      }
    } catch (err) {
      featureGatesLogger.error({ err }, 'Failed to send metrics')
    }
  }
}
