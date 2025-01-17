import PQueue from 'p-queue'
import { Database } from './db'
import { dbLogger } from './logger'
import { boundAbortController, isCausedBySignal, startInterval } from './util'

type Task = (db: Database, signal: AbortSignal) => Promise<void>

/**
 * A simple queue for in-process, out-of-band/backgrounded work
 */
export class BackgroundQueue {
  private abortController = new AbortController()
  private queue = new PQueue({ concurrency: 20 })

  public get signal() {
    return this.abortController.signal
  }

  public get destroyed() {
    return this.signal.aborted
  }

  constructor(protected db: Database) {}

  getStats() {
    return {
      runningCount: this.queue.pending,
      waitingCount: this.queue.size,
    }
  }

  /**
   * Add a task that will be executed at some point in the future.
   *
   * The task will be executed even if the backgroundQueue is destroyed, unless
   * the provided `signal` is aborted.
   *
   * The `signal` provided to the task will be aborted whenever either the
   * backgroundQueue is destroyed or the provided `signal` is aborted.
   */
  async add(task: Task, signal?: AbortSignal): Promise<void> {
    if (this.destroyed) {
      return
    }

    const abortController = boundAbortController(this.signal, signal)

    return this.queue.add<void>(async () => {
      try {
        // Do not run the task if the signal provided to the task has become
        // aborted. Do not use `abortController.signal` here since we do not
        // want to abort the task if the backgroundQueue is being destroyed.
        if (signal?.aborted) return

        await task(this.db, abortController.signal)
      } catch (err) {
        if (!isCausedBySignal(err, abortController.signal)) {
          dbLogger.error(err, 'background queue task failed')
        }
      } finally {
        abortController.abort()
      }
    })
  }

  async processAll() {
    await this.queue.onIdle()
  }

  /**
   * On destroy we stop accepting new tasks, but complete all
   * pending/in-progress tasks. Tasks can decide to abort their current
   * operation based on the signal they received. The application calls this
   * only once http connections have drained (tasks no longer being added).
   */
  async destroy() {
    this.abortController.abort()
    await this.queue.onIdle()
  }
}

/**
 * A simple periodic background task runner
 */
export class PeriodicBackgroundTask {
  private abortController: AbortController
  private promise?: Promise<void>

  public get signal() {
    return this.abortController.signal
  }

  public get destroyed() {
    return this.signal.aborted
  }

  constructor(
    protected backgroundQueue: BackgroundQueue,
    protected interval: number,
    protected task: Task,
  ) {
    if (!Number.isFinite(interval) || interval <= 0) {
      throw new TypeError('interval must be a positive number')
    }

    // Bind this class's signal to the backgroundQueue's signal (destroying this
    // instance if the backgroundQueue is destroyed)
    this.abortController = boundAbortController(backgroundQueue.signal)
  }

  async start() {
    // Noop if already started. Throws if the signal is aborted (destroyed).
    this.promise ||= startInterval(
      async (signal) => this.backgroundQueue.add(this.task, signal),
      this.interval,
      this.signal,
    )
  }

  async destroy() {
    this.abortController.abort()

    await this.promise
    this.promise = undefined
  }
}
