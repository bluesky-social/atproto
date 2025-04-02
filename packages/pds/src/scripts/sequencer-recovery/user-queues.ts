import PQueue from 'p-queue'
export class UserQueues {
  main: PQueue
  queues = new Map<string, PQueue>()

  constructor(concurrency: number) {
    this.main = new PQueue({ concurrency })
  }

  async addToUser(did: string, task: () => Promise<void>) {
    if (this.main.isPaused) return
    return this.main.add(() => {
      return this.getQueue(did).add(task)
    })
  }

  private getQueue(did: string) {
    let queue = this.queues.get(did)
    if (!queue) {
      queue = new PQueue({ concurrency: 1 })
      queue.once('idle', () => this.queues.delete(did))
      this.queues.set(did, queue)
    }
    return queue
  }

  async onEmpty() {
    await this.main.onEmpty()
  }

  async processAll() {
    await this.main.onIdle()
  }

  async destroy() {
    this.main.pause()
    this.main.clear()
    this.queues.forEach((q) => q.clear())
    await this.processAll()
  }
}
