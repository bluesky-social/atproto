import { MINUTE } from '@atproto/common'
import { Client } from '@atproto/lex'
import { BackgroundQueue } from './background'
import { com } from './lexicons/index.js'
import { crawlerLogger as log } from './logger'

const NOTIFY_THRESHOLD = 20 * MINUTE

export class Crawlers {
  public clients: Map<string, Client>
  public lastNotified = 0

  constructor(
    public hostname: string,
    public crawlers: Iterable<string>,
    public backgroundQueue: BackgroundQueue,
  ) {
    this.clients = new Map(
      Array.from(crawlers, (service) => [service, new Client(service)]),
    )
  }

  async notifyOfUpdate() {
    const now = Date.now()
    if (now - this.lastNotified < NOTIFY_THRESHOLD) {
      return
    }

    this.backgroundQueue.add(async () => {
      await Promise.all(
        Array.from(this.clients.entries(), async ([service, client]) => {
          try {
            await client.call(com.atproto.sync.requestCrawl, {
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
