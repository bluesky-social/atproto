import AtpAgent from '@atproto/api'
import { PrimaryDatabase } from '../db'
import { Redis } from '../redis'
import { IngesterConfig } from './config'
import { LabelSubscription } from './label-subscription'

export class IngesterContext {
  constructor(
    private opts: {
      db: PrimaryDatabase
      redis: Redis
      cfg: IngesterConfig
      labelAgent: AtpAgent
      labelSubscription: LabelSubscription
    },
  ) {}

  get db(): PrimaryDatabase {
    return this.opts.db
  }

  get redis(): Redis {
    return this.opts.redis
  }

  get cfg(): IngesterConfig {
    return this.opts.cfg
  }

  get labelAgent(): AtpAgent {
    return this.opts.labelAgent
  }

  get labelSubscription(): LabelSubscription {
    return this.opts.labelSubscription
  }
}

export default IngesterContext
