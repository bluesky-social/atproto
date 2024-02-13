import express from 'express'
import * as plc from '@did-plc/lib'
import { DidCache, IdResolver } from '@atproto/identity'
import { Keypair } from '@atproto/crypto'
import { createServiceJwt } from '@atproto/xrpc-server'
import { ServerConfig } from './config'
import { MountedAlgos } from './api/feed-gen/types'
import { DataPlaneClient } from './data-plane/client'
import { Hydrator } from './hydration/hydrator'
import { Views } from './views'
import { AuthVerifier } from './auth-verifier'
import { dedupeStrs } from '@atproto/common'

export class AppContext {
  constructor(
    private opts: {
      cfg: ServerConfig
      dataplane: DataPlaneClient
      hydrator: Hydrator
      views: Views
      signingKey: Keypair
      idResolver: IdResolver
      didCache?: DidCache
      algos: MountedAlgos
      authVerifier: AuthVerifier
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

  get didCache(): DidCache | undefined {
    return this.opts.didCache
  }

  get authVerifier() {
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

  reqLabelers(req: express.Request): string[] {
    const val = req.header('atproto-labelers')
    if (!val) return this.cfg.labelsFromIssuerDids
    return dedupeStrs(
      val
        .split(',')
        .map((did) => did.trim())
        .slice(0, 10),
    )
  }

  get algos(): MountedAlgos {
    return this.opts.algos
  }
}

export default AppContext
