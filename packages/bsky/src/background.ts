import PQueue from 'p-queue'
import { PrimaryDatabase } from './db'
import { dbLogger } from './logger'

// A simple queue for in-process, out-of-band/backgrounded work

export class BackgroundQueue {
  queue = new PQueue({ concurrency: 20 })
  destroyed = false
  constructor(public db: PrimaryDatabase) {}

  add(task: Task) {
    if (this.destroyed) {
      return
    }
    this.queue
      .add(() => task(this.db))
      .catch((err) => {
        dbLogger.error(err, 'background queue task failed')
      })
  }

  async processAll() {
    await this.queue.onIdle()
  }

  // On destroy we stop accepting new tasks, but complete all pending/in-progress tasks.
  // The application calls this only once http connections have drained (tasks no longer being added).
  async destroy() {
    this.destroyed = true
    await this.queue.onIdle()
  }
}

type Task = (db: PrimaryDatabase) => Promise<void>
