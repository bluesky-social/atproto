import { tidyNotifications } from '../services/util/notification'
import DaemonContext from './context'
import logger from './logger'

export class NotificationsDaemon {
  ac = new AbortController()
  running: Promise<void> | undefined
  constructor(private ctx: DaemonContext) {}

  run() {
    if (this.running) return
    this.running = this.tidyNotifications()
      .catch((err) => logger.error({ err }, 'notifications daemon failed'))
      .finally(() => (this.running = undefined))
  }

  private async tidyNotifications() {
    const actorService = this.ctx.services.actor(this.ctx.db)
    for await (const { did } of actorService.all({ forever: true })) {
      if (this.ac.signal.aborted) return
      try {
        await tidyNotifications(this.ctx.db, did)
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
