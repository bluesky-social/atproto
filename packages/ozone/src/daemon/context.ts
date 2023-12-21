import { DaemonConfig } from './config'
import { Database } from '../db'
import { Services } from '../services'
import { EventPusher } from './event-pusher'
import { EventReverser } from './event-reverser'

export class DaemonContext {
  constructor(
    private opts: {
      db: Database
      cfg: DaemonConfig
      services: Services
      eventPusher: EventPusher
      eventReverser: EventReverser
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

  get eventReverser(): EventReverser {
    return this.opts.eventReverser
  }
}

export default DaemonContext
