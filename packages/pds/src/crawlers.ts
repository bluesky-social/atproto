import { AtpAgent } from '@atproto/api'
import { MINUTE } from '@atproto/common'
import { BackgroundQueue } from './background'
import { crawlerLogger as log } from './logger'

const NOTIFY_THRESHOLD = 20 * MINUTE

export class Crawlers {
  public agents: AtpAgent[]
  public lastNotified = 0

  constructor(
    public hostname: string,
    public crawlers: string[],
    public backgroundQueue: BackgroundQueue,
    public devMode: boolean = false,
  ) {
    this.agents = crawlers.map((service) => new AtpAgent({ service }))
  }

  async notifyOfUpdate() {
    // Skip crawl notifications in development mode to prevent sending dev data to production servers
    if (this.devMode) {
      return
    }

    const now = Date.now()
    if (now - this.lastNotified < NOTIFY_THRESHOLD) {
      return
    }

    this.backgroundQueue.add(async () => {
      await Promise.all(
        this.agents.map(async (agent) => {
          try {
            await agent.api.com.atproto.sync.requestCrawl({
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
    })
  }
}
