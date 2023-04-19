import * as plc from '@did-plc/lib'
import { DidResolver } from '@atproto/did-resolver'
import { Database } from './db'
import { ServerConfig } from './config'
import { ImageUriBuilder } from './image/uri'
import { Services } from './services'
import { Labeler } from './labeler'

export class AppContext {
  constructor(
    private opts: {
      db: Database
      imgUriBuilder: ImageUriBuilder
      cfg: ServerConfig
      services: Services
      didResolver: DidResolver
      labeler: Labeler
    },
  ) {}

  get db(): Database {
    return this.opts.db
  }

  get imgUriBuilder(): ImageUriBuilder {
    return this.opts.imgUriBuilder
  }

  get cfg(): ServerConfig {
    return this.opts.cfg
  }

  get services(): Services {
    return this.opts.services
  }

  get plcClient(): plc.Client {
    return new plc.Client(this.cfg.didPlcUrl)
  }

  get didResolver(): DidResolver {
    return this.opts.didResolver
  }

  get labeler(): Labeler {
    return this.opts.labeler
  }
}

export default AppContext
