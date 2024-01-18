import { IdResolver } from '@atproto/identity'
import { PrimaryDatabase } from '../db'
import { IndexerConfig } from './config'
import { Services } from './services'
import { BackgroundQueue } from '../background'
import DidSqlCache from '../did-cache'
import { Redis } from '../redis'
import { AutoModerator } from '../auto-moderator'
import { Keypair } from '@atproto/crypto'

export class IndexerContext {
  constructor(
    private opts: {
      db: PrimaryDatabase
      redis: Redis
      redisCache: Redis
      cfg: IndexerConfig
      services: Services
      idResolver: IdResolver
      didCache: DidSqlCache
      backgroundQueue: BackgroundQueue
      autoMod: AutoModerator
      signingKey: Keypair
    },
  ) {}

  get db(): PrimaryDatabase {
    return this.opts.db
  }

  get redis(): Redis {
    return this.opts.redis
  }

  get redisCache(): Redis {
    return this.opts.redisCache
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

  get autoMod(): AutoModerator {
    return this.opts.autoMod
  }

  get signingKey(): Keypair {
    return this.opts.signingKey
  }
}

export default IndexerContext
