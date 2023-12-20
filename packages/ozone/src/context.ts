import * as plc from '@did-plc/lib'
import { IdResolver } from '@atproto/identity'
import { AtpAgent } from '@atproto/api'
import { Keypair } from '@atproto/crypto'
import { createServiceJwt } from '@atproto/xrpc-server'
import { Database } from './db'
import { ServerConfig } from './config'
import { Services } from './services'
import * as auth from './auth'
import { BackgroundQueue } from './background'
import { OzoneDaemon } from './daemon'

export class AppContext {
  public moderationPushAgent: AtpAgent | undefined
  constructor(
    private opts: {
      db: Database
      appviewAgent: AtpAgent
      cfg: ServerConfig
      services: Services
      signingKey: Keypair
      idResolver: IdResolver
      backgroundQueue: BackgroundQueue
      daemon?: OzoneDaemon
    },
  ) {
    if (opts.cfg.moderationPushUrl) {
      const url = new URL(opts.cfg.moderationPushUrl)
      this.moderationPushAgent = new AtpAgent({ service: url.origin })
      this.moderationPushAgent.api.setHeader(
        'authorization',
        auth.buildBasicAuth(url.username, url.password),
      )
    }
  }

  get db(): Database {
    return this.opts.db
  }

  get cfg(): ServerConfig {
    return this.opts.cfg
  }

  get services(): Services {
    return this.opts.services
  }

  get appviewAgent(): AtpAgent {
    return this.opts.appviewAgent
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

  get backgroundQueue(): BackgroundQueue {
    return this.opts.backgroundQueue
  }

  get daemon(): OzoneDaemon | undefined {
    return this.opts.daemon
  }

  get authVerifier() {
    return auth.authVerifier(this.idResolver, { aud: this.cfg.serverDid })
  }

  get authVerifierAnyAudience() {
    return auth.authVerifier(this.idResolver, { aud: null })
  }

  get authOptionalVerifierAnyAudience() {
    return auth.authOptionalVerifier(this.idResolver, { aud: null })
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

  async serviceAuthJwt(aud: string) {
    const iss = this.cfg.serverDid
    return createServiceJwt({
      iss,
      aud,
      keypair: this.signingKey,
    })
  }
}

export default AppContext
