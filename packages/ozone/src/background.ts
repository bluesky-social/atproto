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
  private queue: PQueue

  public get signal() {
    return this.abortController.signal
  }

  public get destroyed() {
    return this.signal.aborted
  }

  constructor(
    protected db: Database,
    queueOpts?: { concurrency?: number },
  ) {
    this.queue = new PQueue(queueOpts ?? { concurrency: 20 })
  }

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

        // The task will receive a "combined signal" allowing it to abort if
        // either the backgroundQueue is destroyed or the provided signal is
        // aborted.
        await task(this.db, abortController.signal)
      } catch (err) {
        if (!isCausedBySignal(err, abortController.signal)) {
          dbLogger.error({ err }, 'background queue task failed')
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
 * A simple periodic background task runner. This class will schedule a task to
 * run through a provided {@link BackgroundQueue} at a fixed interval. The task
 * will never run more than once concurrently, and will wait at least `interval`
 * milliseconds between the end of one run and the start of the next.
 */
export class PeriodicBackgroundTask {
  private abortController: AbortController

  private intervalPromise?: Promise<void>
  private runningPromise?: Promise<void>

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

  public run(signal?: AbortSignal): Promise<void> {
    // `startInterval` already ensures that only one run is in progress at a
    // time. However, we want to be able to expose a `run()` method that can be
    // used to force a run, which could cause concurrent executions. We prevent
    // this using the `runningPromise` property.

    if (this.runningPromise) return this.runningPromise

    // Combine the `this.signal` with the provided `signal`, if any.
    const abortController = boundAbortController(this.signal, signal)

    const promise = this.backgroundQueue.add(this.task, abortController.signal)

    return (this.runningPromise = promise).finally(() => {
      if (this.runningPromise === promise) this.runningPromise = undefined

      // Cleanup the listeners added by `boundAbortController`
      abortController.abort()
    })
  }

  public start() {
    // Noop if already started. Throws if this.signal is aborted (instance is
    // destroyed).
    this.intervalPromise ||= startInterval(
      async (signal) => this.run(signal),
      this.interval,
      this.signal,
    )
  }

  public async destroy() {
    // @NOTE This instance does not "own" the backgroundQueue, so we do not
    // destroy it here.

    this.abortController.abort()

    await this.intervalPromise
    this.intervalPromise = undefined
  }
}
