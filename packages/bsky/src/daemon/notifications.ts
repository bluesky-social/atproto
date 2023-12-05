import { tidyNotifications } from '../services/util/notification'
import DaemonContext from './context'
import logger from './logger'

export class NotificationsDaemon {
  ac = new AbortController()
  running: Promise<void> | undefined
  count = 0
  lastDid: string | null = null

  constructor(private ctx: DaemonContext) {}

  run(opts?: RunOptions) {
    if (this.running) return
    this.count = 0
    this.lastDid = null
    this.ac = new AbortController()
    this.running = this.tidyNotifications({
      ...opts,
      forever: opts?.forever !== false, // run forever by default
    })
      .catch((err) => {
        // allow this to cause an unhandled rejection, let deployment handle the crash.
        logger.error({ err }, 'notifications daemon crashed')
        throw err
      })
      .finally(() => (this.running = undefined))
  }

  private async tidyNotifications(opts: RunOptions) {
    const actorService = this.ctx.services.actor(this.ctx.db)
    for await (const { did } of actorService.all(opts)) {
      if (this.ac.signal.aborted) return
      try {
        await tidyNotifications(this.ctx.db, did)
        this.count++
        this.lastDid = did
      } catch (err) {
        logger.warn({ err, did }, 'failed to tidy notifications for actor')
      }
    }
  }

  async destroy() {
    this.ac.abort()
    await this.running
  }
}

type RunOptions = { forever?: boolean; batchSize?: number }
