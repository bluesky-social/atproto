import { Database } from '../db'
import { Redis } from '../redis'
import { IngesterConfig } from './config'

export class IngesterContext {
  constructor(
    private opts: {
      db: Database
      redis: Redis
      cfg: IngesterConfig
    },
  ) {}

  get db(): Database {
    return this.opts.db
  }

  get redis(): Redis {
    return this.opts.redis
  }

  get cfg(): IngesterConfig {
    return this.opts.cfg
  }
}

export default IngesterContext
