import { PrimaryDatabase } from '../db'
import { Redis } from '../redis'
import { IngesterConfig } from './config'
import { LabelSubscription } from './label-subscription'
import { MuteSubscription } from './mute-subscription'

export class IngesterContext {
  constructor(
    private opts: {
      db: PrimaryDatabase
      redis: Redis
      cfg: IngesterConfig
      labelSubscription?: LabelSubscription
      muteSubscription?: MuteSubscription
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

  get muteSubscription(): MuteSubscription | undefined {
    return this.opts.muteSubscription
  }
}

export default IngesterContext
