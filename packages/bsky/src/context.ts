import * as plc from '@did-plc/lib'
import { IdResolver } from '@atproto/identity'
import { Database } from './db'
import { ServerConfig } from './config'
import { ImageUriBuilder } from './image/uri'
import { Services } from './services'
import * as auth from './auth'
import DidSqlCache from './did-cache'
import { Labeler } from './labeler'
import { BackgroundQueue } from './background'
import { MountedAlgos } from './feed-gen/types'

export class AppContext {
  constructor(
    private opts: {
      db: Database
      imgUriBuilder: ImageUriBuilder
      cfg: ServerConfig
      services: Services
      idResolver: IdResolver
      didCache: DidSqlCache
      labeler: Labeler
      backgroundQueue: BackgroundQueue
      algos: MountedAlgos
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

  get idResolver(): IdResolver {
    return this.opts.idResolver
  }

  get didCache(): DidSqlCache {
    return this.opts.didCache
  }

  get authVerifier() {
    return auth.authVerifier(this.idResolver, { aud: this.cfg.serverDid })
  }

  get authVerifierAnyAudience() {
    return auth.authVerifier(this.idResolver, { aud: null })
  }

  get authOptionalVerifier() {
    return auth.authOptionalVerifier(this.idResolver, {
      aud: this.cfg.serverDid,
    })
  }

  get labeler(): Labeler {
    return this.opts.labeler
  }

  get backgroundQueue(): BackgroundQueue {
    return this.opts.backgroundQueue
  }

  get algos(): MountedAlgos {
    return this.opts.algos
  }
}

export default AppContext
