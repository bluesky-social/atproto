import * as plc from '@did-plc/lib'
import { IdResolver } from '@atproto/identity'
import { AtpAgent } from '@atproto/api'
import { Keypair } from '@atproto/crypto'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import { Database } from './db'
import { ServerConfig } from './config'
import { ModerationServiceCreator } from './mod-service'
import * as auth from './auth'
import { BackgroundQueue } from './background'
import { OzoneDaemon } from './daemon'

export class AppContext {
  constructor(
    private opts: {
      db: Database
      cfg: ServerConfig
      modService: ModerationServiceCreator
      appviewAgent: AtpAgent
      pdsAgent: AtpAgent | undefined
      signingKey: Keypair
      idResolver: IdResolver
      backgroundQueue: BackgroundQueue
      daemon?: OzoneDaemon
    },
  ) {}

  get db(): Database {
    return this.opts.db
  }

  get cfg(): ServerConfig {
    return this.opts.cfg
  }

  get modService(): ModerationServiceCreator {
    return this.opts.modService
  }

  get appviewAgent(): AtpAgent {
    return this.opts.appviewAgent
  }

  get pdsAgent(): AtpAgent | undefined {
    return this.opts.pdsAgent
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

  async serviceAuthHeaders(aud: string) {
    const iss = this.cfg.serverDid
    return createServiceAuthHeaders({
      iss,
      aud,
      keypair: this.signingKey,
    })
  }

  async pdsAuth() {
    if (!this.cfg.pdsDid) {
      return undefined
    }
    return this.serviceAuthHeaders(this.cfg.pdsDid)
  }

  async appviewAuth() {
    if (!this.cfg.appviewDid) {
      return undefined
    }
    return this.serviceAuthHeaders(this.cfg.appviewDid)
  }
}

export default AppContext
