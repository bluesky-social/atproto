import { Event } from '../events'
import { Firehose, FirehoseOptions } from '../firehose'
import { ConsecutiveList } from './consecutive-list'
import { PartitionedQueue } from './partitioned'

export type SyncQueueOptions = {
  handleEvt: (evt: Event) => Promise<void>
  setCursor?: (cursor: number) => Promise<void>
  onError?: (err: Error) => void
}

export class SyncQueue {
  consecutive = new ConsecutiveList<number>()
  repoQueue = new PartitionedQueue({ concurrency: Infinity })
  cursor = 0

  public firehose: Firehose | undefined

  constructor(public opts: SyncQueueOptions) {}

  addFirehose(opts: FirehoseOptions) {
    if (this.firehose) {
      throw new Error('already consuming from firehose')
    }
    this.firehose = new Firehose({
      getCursor: async () => this.cursor,
      onError: opts.onError ?? this.opts.onError,
      ...opts,
    })
    this.readFirehose()
  }

  private async readFirehose() {
    if (!this.firehose) {
      throw new Error('firehose is undefined')
    }
    for await (const evt of this.firehose) {
      this.addEvent(evt)
      await this.repoQueue.main.onEmpty() // backpressure
    }
  }

  async removeFirehose() {
    await this.firehose?.destroy()
    this.firehose = undefined
  }

  async addEvent(evt: Event) {
    try {
      const item = this.consecutive.push(evt.seq)
      await this.repoQueue.add(evt.did, () => this.opts.handleEvt(evt))
      const latest = item.complete().at(-1)
      if (latest !== undefined) {
        this.cursor = latest
        if (this.opts.setCursor) {
          try {
            await this.opts.setCursor(this.cursor)
          } catch (err) {
            this.sendError(new SyncQueueCursorError(err, this.cursor))
          }
        }
      }
    } catch (err) {
      this.sendError(new SyncQueueHandlerError(err, evt))
    }
  }

  private sendError(err: Error) {
    if (this.opts.onError) {
      this.opts.onError(err)
    }
  }

  async processAll() {
    await this.repoQueue.main.onIdle()
  }

  async destroy() {
    await this.firehose?.destroy()
    await this.repoQueue.destroy()
  }
}

export class SyncQueueCursorError extends Error {
  constructor(
    public err: unknown,
    public cursor: number,
  ) {
    super(`error setting cursor: ${err}`)
  }
}

export class SyncQueueHandlerError extends Error {
  constructor(
    public err: unknown,
    public event: Event,
  ) {
    super(`error in event handler: ${err}`)
  }
}
