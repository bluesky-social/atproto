import { Redis } from 'ioredis'
import { Database } from '../db'
import { IndexerConfig } from './config'
import { Services } from './services'

export class IndexerContext {
  constructor(
    private opts: {
      db: Database
      redis: Redis
      cfg: IndexerConfig
      services: Services
    },
  ) {}

  get db(): Database {
    return this.opts.db
  }

  get redis(): Redis {
    return this.opts.redis
  }

  get cfg(): IndexerConfig {
    return this.opts.cfg
  }

  get services(): Services {
    return this.opts.services
  }
}

export default IndexerContext
