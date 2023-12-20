import { DaemonConfig } from './config'
import { Database } from '../db'
import { Services } from '../services'
import { EventPusher } from './event-pusher'

export class DaemonContext {
  constructor(
    private opts: {
      db: Database
      cfg: DaemonConfig
      services: Services
      eventPusher: EventPusher
    },
  ) {}

  get db(): Database {
    return this.opts.db
  }

  get cfg(): DaemonConfig {
    return this.opts.cfg
  }

  get services(): Services {
    return this.opts.services
  }

  get eventPusher(): EventPusher {
    return this.opts.eventPusher
  }
}

export default DaemonContext
