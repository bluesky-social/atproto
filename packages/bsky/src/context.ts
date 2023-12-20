import * as plc from '@did-plc/lib'
import { IdResolver } from '@atproto/identity'
import { AtpAgent } from '@atproto/api'
import { Keypair } from '@atproto/crypto'
import { createServiceJwt } from '@atproto/xrpc-server'
import { ServerConfig } from './config'
import * as auth from './auth'
import { MountedAlgos } from './api/feed-gen/types'
import { DataPlaneClient } from './data-plane/client'
import { Hydrator } from './hydration/hydrator'
import { Views } from './views'

export class AppContext {
  public moderationPushAgent: AtpAgent | undefined
  constructor(
    private opts: {
      cfg: ServerConfig
      dataplane: DataPlaneClient
      hydrator: Hydrator
      views: Views
      signingKey: Keypair
      idResolver: IdResolver
      algos: MountedAlgos
    },
  ) {}

  get cfg(): ServerConfig {
    return this.opts.cfg
  }

  get dataplane(): DataPlaneClient {
    return this.opts.dataplane
  }

  get hydrator(): Hydrator {
    return this.opts.hydrator
  }

  get views(): Views {
    return this.opts.views
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

  get algos(): MountedAlgos {
    return this.opts.algos
  }
}

export default AppContext
