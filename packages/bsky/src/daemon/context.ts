import { PrimaryDatabase } from '../db'
import { DaemonConfig } from './config'
import { Services } from './services'

export class DaemonContext {
  constructor(
    private opts: {
      db: PrimaryDatabase
      cfg: DaemonConfig
      services: Services
    },
  ) {}

  get db(): PrimaryDatabase {
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
