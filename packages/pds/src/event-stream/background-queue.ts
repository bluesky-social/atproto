import PQueue from 'p-queue'
import Database from '../db'
import { dbLogger } from '../logger'

// A simple queue for in-process, out-of-band/backgrounded work

export class BackgroundQueue {
  queue = new PQueue()
  constructor(public db: Database) {}

  add(task: Task) {
    this.queue
      .add(() => task(this.db))
      .catch((err) => {
        dbLogger.error(err, 'background queue task failed')
      })
  }

  async processAll() {
    await this.queue.onIdle()
  }

  async destroy() {
    this.queue.pause()
    this.queue.clear()
    await this.queue.onIdle()
  }
}

type Task = (db: Database) => Promise<void>
