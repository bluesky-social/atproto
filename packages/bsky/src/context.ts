import * as plc from '@did-plc/lib'
import { DidResolver } from '@atproto/did-resolver'
import { Database } from './db'
import { ServerConfig } from './config'
import { ImageUriBuilder } from './image/uri'
import { Services } from './services'
import * as auth from './auth'
import DidSqlCache from './did-cache'
import { Labeler } from './labeler'

export class AppContext {
  constructor(
    private opts: {
      db: Database
      imgUriBuilder: ImageUriBuilder
      cfg: ServerConfig
      services: Services
      didResolver: DidResolver
      didCache: DidSqlCache
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

  get didCache(): DidSqlCache {
    return this.opts.didCache
  }

  get authVerifier() {
    return auth.authVerifier(this.cfg.serverDid, this.didResolver)
  }

  get authOptionalVerifier() {
    return auth.authOptionalVerifier(this.cfg.serverDid, this.didResolver)
  }

  get labeler(): Labeler {
    return this.opts.labeler
  }
}

export default AppContext
