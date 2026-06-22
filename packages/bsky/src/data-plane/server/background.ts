import PQueue from 'p-queue'
import { dbLogger } from '../../logger.js'

// A simple queue for in-process, out-of-band/backgrounded work

export class BackgroundQueue<TContext = unknown> {
  private abortController = new AbortController()
  private queue: PQueue

  public get signal(): AbortSignal {
    return this.abortController.signal
  }

  public get destroyed() {
    return this.signal.aborted
  }

  constructor(
    private readonly context: TContext,
    queueOpts?: { concurrency?: number },
  ) {
    this.queue = new PQueue(queueOpts)
  }

  add(task: Task<TContext>) {
    if (this.destroyed) return

    this.queue.add<void>(async () => {
      try {
        // The task will receive a signal allowing it to abort if the
        // backgroundQueue is destroyed.
        await task(this.context, this.signal)
      } catch (err) {
        dbLogger.error({ err }, 'background queue task failed')
      }
    })
  }

  async processAll() {
    const { queue } = this
    if (queue.size || queue.pending) await queue.onIdle()
  }

  // On destroy we stop accepting new tasks, but complete all pending/in-progress tasks.
  // The application calls this only once http connections have drained (tasks no longer being added).
  async destroy() {
    if (!this.destroyed) {
      this.abortController.abort()
    } else {
      dbLogger.warn('BackgroundQueue.destroy() called multiple times')
    }

    return this.processAll()
  }
}

type Task<TContext> = (ctx: TContext, signal: AbortSignal) => Promise<void>
