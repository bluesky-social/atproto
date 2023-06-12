import { AtpAgent } from '@atproto/api'
import { crawlerLogger as log } from './logger'
import { MINUTE } from '@atproto/common'

const NOTIFY_THRESHOLD = 20 * MINUTE

export class Crawlers {
  public agents: AtpAgent[]
  public lastNotified = 0

  constructor(public hostname: string, public crawlers: string[]) {
    this.agents = crawlers.map((service) => new AtpAgent({ service }))
  }

  async notifyOfUpdate() {
    const now = Date.now()
    if (now - this.lastNotified < NOTIFY_THRESHOLD) {
      return
    }

    await Promise.all(
      this.agents.map(async (agent) => {
        try {
          await agent.api.com.atproto.sync.notifyOfUpdate({
            hostname: this.hostname,
          })
        } catch (err) {
          log.warn(
            { err, cralwer: agent.service.toString() },
            'failed to request crawl',
          )
        }
      }),
    )
    this.lastNotified = now
  }
}
