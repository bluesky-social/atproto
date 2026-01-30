import { xrpc } from '@atproto/lex'
import { BackgroundQueue } from './background.js'
import { com } from './lexicons/index.js'
import { crawlerLogger as log } from './logger.js'

const NOTIFY_THRESHOLD = 20 * 60e3

export class Crawlers {
  private lastNotified = -Infinity

  constructor(
    private readonly backgroundQueue: BackgroundQueue,
    private readonly hostname: string,
    private readonly crawlers: Iterable<string>,
  ) {}

  notifyOfUpdate() {
    const now = Date.now()
    if (this.lastNotified < now - NOTIFY_THRESHOLD) {
      this.lastNotified = now
      this.requestCrawl()
    } else {
      // @TODO We should probably actually schedule (setTimeout) a crawl for
      // when the threshold is met, instead of just waiting for the next update
      // to trigger it. Not doing this now as it requires cleanup logic on
      // shutdown.
    }
  }

  private requestCrawl() {
    for (const crawler of this.crawlers) {
      this.backgroundQueue.add(async () => {
        try {
          await xrpc(crawler, com.atproto.sync.requestCrawl, {
            body: { hostname: this.hostname },
          })
        } catch (err) {
          log.warn({ err, crawler }, 'failed to request crawl')
        }
      })
    }
  }
}
