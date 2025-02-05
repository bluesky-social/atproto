import { dataplaneLogger as logger } from '../../../logger'

export class Batcher<T = unknown> {
  ac = new AbortController()
  batch: T[] = []
  processing: Promise<void> | null = null
  backpressuring: Promise<void> | null = null
  constructor(
    private opts: {
      process: (items: T[]) => Promise<void>
      backpressure: (signal: AbortSignal) => Promise<void> | null
    },
  ) {}
  async add(item: T) {
    if (this.ac.signal.aborted) return
    this.backpressuring = this.backpressure()
    if (this.backpressuring) {
      await this.backpressuring
    }
    if (this.ac.signal.aborted) return
    this.batch.push(item)
    this.processing = this.process()
  }
  process() {
    if (this.processing) {
      return this.processing
    }
    if (this.ac.signal.aborted) {
      return null
    }
    if (this.batch.length === 0) {
      return null
    }
    const batch = this.batch
    this.batch = []
    return this.opts
      .process(batch)
      .catch((err) => {
        logger.error({ err }, 'batcher processing failed')
        this.batch = [...batch, ...this.batch]
      })
      .finally(() => {
        this.processing = null
        this.processing = this.process()
      })
  }
  backpressure() {
    if (this.backpressuring) {
      return this.backpressuring
    }
    if (this.ac.signal.aborted) {
      return null
    }
    const backpressuring = this.opts.backpressure(this.ac.signal)
    if (!backpressuring) {
      return null
    }
    return backpressuring.catch((err) => {
      logger.error({ err }, 'batcher backpressure failed')
    })
  }
  async stop() {
    this.ac.abort()
    this.batch = []
    await this.processing
  }
}
