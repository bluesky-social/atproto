import * as plc from '@did-plc/lib'
import { IdResolver } from '@atproto/identity'
import { AtpAgent } from '@atproto/api'
import { Keypair } from '@atproto/crypto'
import { createServiceJwt } from '@atproto/xrpc-server'
import { DatabaseCoordinator } from './db'
import { ServerConfig } from './config'
import { ImageUriBuilder } from './image/uri'
import { Services } from './services'
import DidRedisCache from './did-cache'
import { BackgroundQueue } from './background'
import { Redis } from './redis'
import { AuthVerifier } from './auth-verifier'
import { BsyncClient } from './bsync'
import { CourierClient } from './courier'

export class AppContext {
  constructor(
    private opts: {
      db: DatabaseCoordinator
      imgUriBuilder: ImageUriBuilder
      cfg: ServerConfig
      services: Services
      signingKey: Keypair
      idResolver: IdResolver
      didCache: DidRedisCache
      redis: Redis
      backgroundQueue: BackgroundQueue
      searchAgent?: AtpAgent
      bsyncClient?: BsyncClient
      courierClient?: CourierClient
      authVerifier: AuthVerifier
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

  get signingKey(): Keypair {
    return this.opts.signingKey
  }

  get plcClient(): plc.Client {
    return new plc.Client(this.cfg.didPlcUrl)
  }

  get idResolver(): IdResolver {
    return this.opts.idResolver
  }

  get didCache(): DidRedisCache {
    return this.opts.didCache
  }

  get redis(): Redis {
    return this.opts.redis
  }

  get searchAgent(): AtpAgent | undefined {
    return this.opts.searchAgent
  }

  get bsyncClient(): BsyncClient | undefined {
    return this.opts.bsyncClient
  }

  get courierClient(): CourierClient | undefined {
    return this.opts.courierClient
  }

  get authVerifier(): AuthVerifier {
    return this.opts.authVerifier
  }

  async serviceAuthJwt(aud: string) {
    const iss = this.cfg.serverDid
    return createServiceJwt({
      iss,
      aud,
      keypair: this.signingKey,
    })
  }

  get backgroundQueue(): BackgroundQueue {
    return this.opts.backgroundQueue
  }
}

export default AppContext
