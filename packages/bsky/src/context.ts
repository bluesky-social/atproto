import * as plc from '@did-plc/lib'
import { Etcd3 } from 'etcd3'
import express from 'express'
import { Dispatcher } from 'undici'
import { AtpAgent } from '@atproto/api'
import { Keypair } from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import { AuthVerifier } from './auth-verifier'
import { BsyncClient } from './bsync'
import { ServerConfig } from './config'
import { CourierClient } from './courier'
import { DataPlaneClient, HostList } from './data-plane/client'
import { FeatureGates } from './feature-gates'
import { Hydrator } from './hydration/hydrator'
import { httpLogger as log } from './logger'
import {
  ParsedLabelers,
  defaultLabelerHeader,
  parseLabelerHeader,
} from './util'
import { Views } from './views'

export class AppContext {
  constructor(
    private opts: {
      cfg: ServerConfig
      etcd: Etcd3 | undefined
      dataplane: DataPlaneClient
      dataplaneHostList: HostList
      searchAgent: AtpAgent | undefined
      suggestionsAgent: AtpAgent | undefined
      topicsAgent: AtpAgent | undefined
      hydrator: Hydrator
      views: Views
      signingKey: Keypair
      idResolver: IdResolver
      bsyncClient: BsyncClient
      courierClient: CourierClient | undefined
      authVerifier: AuthVerifier
      featureGates: FeatureGates
      blobDispatcher: Dispatcher
    },
  ) {}

  get cfg(): ServerConfig {
    return this.opts.cfg
  }

  get etcd() {
    return this.opts.etcd
  }

  get dataplane(): DataPlaneClient {
    return this.opts.dataplane
  }

  get dataplaneHostList(): HostList {
    return this.opts.dataplaneHostList
  }

  get searchAgent(): AtpAgent | undefined {
    return this.opts.searchAgent
  }

  get suggestionsAgent(): AtpAgent | undefined {
    return this.opts.suggestionsAgent
  }

  get topicsAgent(): AtpAgent | undefined {
    return this.opts.topicsAgent
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

  get bsyncClient(): BsyncClient {
    return this.opts.bsyncClient
  }

  get courierClient(): CourierClient | undefined {
    return this.opts.courierClient
  }

  get authVerifier(): AuthVerifier {
    return this.opts.authVerifier
  }

  get featureGates(): FeatureGates {
    return this.opts.featureGates
  }

  get blobDispatcher(): Dispatcher {
    return this.opts.blobDispatcher
  }

  reqLabelers(req: express.Request): ParsedLabelers {
    const val = req.header('atproto-accept-labelers')
    let parsed: ParsedLabelers | null
    try {
      parsed = parseLabelerHeader(val)
    } catch (err) {
      parsed = null
      log.info({ err, val }, 'failed to parse labeler header')
    }
    if (!parsed) return defaultLabelerHeader(this.cfg.labelsFromIssuerDids)
    return parsed
  }
}
