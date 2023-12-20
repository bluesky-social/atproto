import { DaemonConfig } from './config'
import { Database } from '../db'
import { Services } from '../services'

export class DaemonContext {
  constructor(
    private opts: {
      db: Database
      cfg: DaemonConfig
      services: Services
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
}

export default DaemonContext
