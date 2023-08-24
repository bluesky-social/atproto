import { IdResolver } from '@atproto/identity'
import { PrimaryDatabase } from '../db'
import { IndexerConfig } from './config'
import { Services } from './services'
import { BackgroundQueue } from '../background'
import DidSqlCache from '../did-cache'
import { Redis } from '../redis'

export class IndexerContext {
  constructor(
    private opts: {
      db: PrimaryDatabase
      redis: Redis
      cfg: IndexerConfig
      services: Services
      idResolver: IdResolver
      didCache: DidSqlCache
      backgroundQueue: BackgroundQueue
    },
  ) {}

  get db(): PrimaryDatabase {
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

  get idResolver(): IdResolver {
    return this.opts.idResolver
  }

  get didCache(): DidSqlCache {
    return this.opts.didCache
  }

  get backgroundQueue(): BackgroundQueue {
    return this.opts.backgroundQueue
  }
}

export default IndexerContext
