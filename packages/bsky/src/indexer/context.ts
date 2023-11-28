import { IdResolver } from '@atproto/identity'
import { PrimaryDatabase } from '../db'
import { IndexerConfig } from './config'
import { Services } from './services'
import { BackgroundQueue } from '../background'
import DidSqlCache from '../did-cache'
import { Redis } from '../redis'
import { AutoModerator } from '../auto-moderator'
import { RedisCache } from '../cache/redis'

export class IndexerContext {
  constructor(
    private opts: {
      db: PrimaryDatabase
      redis: Redis
      cfg: IndexerConfig
      services: Services
      idResolver: IdResolver
      didCache: DidSqlCache
      redisCache: RedisCache
      backgroundQueue: BackgroundQueue
      autoMod: AutoModerator
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

  get redisCache(): RedisCache {
    return this.opts.redisCache
  }

  get backgroundQueue(): BackgroundQueue {
    return this.opts.backgroundQueue
  }

  get autoMod(): AutoModerator {
    return this.opts.autoMod
  }
}

export default IndexerContext
