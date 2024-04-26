import { AtpAgent } from '@atproto/api'
import { crawlerLogger as log } from './logger'
import { MINUTE } from '@atproto/common'
import { BackgroundQueue } from './background'

const NOTIFY_THRESHOLD = 20 * MINUTE

export class Crawlers {
  public lastNotified = 0

  constructor(
    public hostname: string,
    public crawlers: string[],
    public backgroundQueue: BackgroundQueue,
  ) {}

  async notifyOfUpdate() {
    const now = Date.now()
    if (now - this.lastNotified < NOTIFY_THRESHOLD) {
      return
    }

    this.backgroundQueue.add(async () => {
      await Promise.all(
        this.crawlers.map(async (service) => {
          try {
            const agent = new AtpAgent({ service })
            await agent.api.com.atproto.sync.requestCrawl({
              hostname: this.hostname,
            })
          } catch (err) {
            log.warn({ err, cralwer: service }, 'failed to request crawl')
          }
        }),
      )
      this.lastNotified = now
    })
  }
}
