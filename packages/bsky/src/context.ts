import * as plc from '@did-plc/lib'
import { IdResolver } from '@atproto/identity'
import { DatabaseCoordinator } from './db'
import { ServerConfig } from './config'
import { ImageUriBuilder } from './image/uri'
import { Services } from './services'
import * as auth from './auth'
import DidSqlCache from './did-cache'
import { BackgroundQueue } from './background'
import { MountedAlgos } from './feed-gen/types'
import { LabelCache } from './label-cache'
import { NotificationServer } from './notifications'

export class AppContext {
  constructor(
    private opts: {
      db: DatabaseCoordinator
      imgUriBuilder: ImageUriBuilder
      cfg: ServerConfig
      services: Services
      idResolver: IdResolver
      didCache: DidSqlCache
      labelCache: LabelCache
      backgroundQueue: BackgroundQueue
      algos: MountedAlgos
      notifServer: NotificationServer
    },
  ) {}

  get db(): DatabaseCoordinator {
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

  get labelCache(): LabelCache {
    return this.opts.labelCache
  }

  get notifServer(): NotificationServer {
    return this.opts.notifServer
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

  get authOptionalAccessOrRoleVerifier() {
    return auth.authOptionalAccessOrRoleVerifier(this.idResolver, this.cfg)
  }

  get roleVerifier() {
    return auth.roleVerifier(this.cfg)
  }

  get backgroundQueue(): BackgroundQueue {
    return this.opts.backgroundQueue
  }

  get algos(): MountedAlgos {
    return this.opts.algos
  }
}

export default AppContext
