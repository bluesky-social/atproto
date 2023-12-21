import { DaemonConfig } from './config'
import { Database } from '../db'
import { EventPusher } from './event-pusher'
import { EventReverser } from './event-reverser'
import { ModerationServiceCreator } from '../mod-service'

export class DaemonContext {
  constructor(
    private opts: {
      db: Database
      cfg: DaemonConfig
      modService: ModerationServiceCreator
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

  get modService(): ModerationServiceCreator {
    return this.opts.modService
  }

  get eventPusher(): EventPusher {
    return this.opts.eventPusher
  }

  get eventReverser(): EventReverser {
    return this.opts.eventReverser
  }
}

export default DaemonContext
