import PQueue from 'p-queue'
import { Database } from './db'
import { dbLogger } from './logger'

type Task = (db: Database, signal: AbortSignal) => Promise<void>

/**
 * A simple queue for in-process, out-of-band/backgrounded work
 */
export class BackgroundQueue {
  private abortController = new AbortController()
  private queue = new PQueue({ concurrency: 20 })

  protected get signal() {
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

  add(task: Task) {
    if (this.destroyed) {
      return
    }

    const { db, signal } = this

    this.queue
      .add(() => task(db, signal))
      .catch((err) => {
        if (!isCausedBySignal(err, signal)) {
          dbLogger.error(err, 'background queue task failed')
        }
      })
  }

  async processAll() {
    await this.queue.onIdle()
  }

  // On destroy we stop accepting new tasks, but complete all
  // pending/in-progress tasks. Tasks can decide to abort their current
  // operation based on the signal they received. The application calls this
  // only once http connections have drained (tasks no longer being added).
  async destroy() {
    this.abortController.abort()
    await this.queue.onIdle()
  }
}

/**
 * A simple periodic background task runner
 */
export class PeriodicBackgroundTask {
  private abortController = new AbortController()
  private promise?: Promise<void>

  protected get signal() {
    return this.abortController.signal
  }

  public get destroyed() {
    return this.signal.aborted
  }

  constructor(
    protected db: Database,
    protected interval: number,
    protected task: Task,
  ) {}

  async start() {
    this.signal.throwIfAborted()
    if (this.promise !== undefined) throw new Error('Already started')

    const { db, task } = this

    this.promise = startInterval(
      async (signal) => {
        try {
          await task(db, signal)
        } catch (err) {
          if (!isCausedBySignal(err, signal)) {
            dbLogger.error(err, 'periodic background task failed')
          }
        }
      },
      this.interval,
      this.signal,
    )
  }

  async destroy() {
    this.signal.throwIfAborted()
    this.abortController.abort()

    await this.promise
    this.promise = undefined
  }
}

/**
 * Determines whether the cause of an error is a signal's reason
 */
function isCausedBySignal(err: unknown, { reason }: AbortSignal) {
  return err === reason || (err instanceof Error && err.cause === reason)
}

function startInterval(
  fn: (signal: AbortSignal) => void | Promise<void>,
  interval: number,
  signal: AbortSignal,
) {
  signal.throwIfAborted()

  return new Promise<void>((resolve) => {
    let timer: NodeJS.Timeout | undefined

    const run = async () => {
      timer = undefined // record that we are running
      try {
        await fn(signal)
      } finally {
        if (signal.aborted) resolve()
        else schedule()
      }
    }

    const schedule = () => {
      timer = setTimeout(run, interval)
    }

    const stop = () => {
      if (timer) {
        clearTimeout(timer)
        resolve()
      } else {
        // fn is running, resolve() will be called
      }
    }

    signal.addEventListener('abort', stop, { once: true })

    schedule()
  })
}
