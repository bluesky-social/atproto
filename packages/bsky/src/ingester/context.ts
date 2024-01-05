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
      labelSubscription?: LabelSubscription
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

  get labelSubscription(): LabelSubscription | undefined {
    return this.opts.labelSubscription
  }
}

export default IngesterContext
