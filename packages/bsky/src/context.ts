import * as plc from '@did-plc/lib'
import type { Etcd3 } from 'etcd3'
import type express from 'express'
import type { Dispatcher } from 'undici'
import type { Keypair } from '@atproto/crypto'
import type { IdResolver } from '@atproto/identity'
import type { Client } from '@atproto/lex'
import type { AuthVerifier } from './auth-verifier.js'
import type { BsyncClient } from './bsync.js'
import type { ServerConfig } from './config.js'
import type { CourierClient } from './courier.js'
import type { DataPlaneClient, HostList } from './data-plane/client/index.js'
import type { FeatureGatesClient } from './feature-gates/index.js'
import type { Hydrator } from './hydration/hydrator.js'
import type { KwsClient } from './kws.js'
import { httpLogger as log } from './logger.js'
import type { RolodexClient } from './rolodex.js'
import type { StashClient } from './stash.js'
import {
  type ParsedLabelers,
  defaultLabelerHeader,
  parseLabelerHeader,
} from './util.js'
import type { Views } from './views/index.js'

export class AppContext {
  constructor(
    private opts: {
      cfg: ServerConfig
      etcd: Etcd3 | undefined
      dataplane: DataPlaneClient
      dataplaneHostList: HostList
      searchClient: Client | undefined
      suggestionsClient: Client | undefined
      topicsClient: Client | undefined
      irisClient: Client | undefined
      hydrator: Hydrator
      views: Views
      signingKey: Keypair
      idResolver: IdResolver
      bsyncClient: BsyncClient
      stashClient: StashClient
      courierClient: CourierClient | undefined
      rolodexClient: RolodexClient | undefined
      authVerifier: AuthVerifier
      featureGatesClient: FeatureGatesClient
      blobDispatcher: Dispatcher
      kwsClient: KwsClient | undefined
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

  get searchClient(): Client | undefined {
    return this.opts.searchClient
  }

  get suggestionsClient(): Client | undefined {
    return this.opts.suggestionsClient
  }

  get topicsClient(): Client | undefined {
    return this.opts.topicsClient
  }

  get irisClient(): Client | undefined {
    return this.opts.irisClient
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

  get stashClient(): StashClient {
    return this.opts.stashClient
  }

  get courierClient(): CourierClient | undefined {
    return this.opts.courierClient
  }

  get rolodexClient(): RolodexClient | undefined {
    return this.opts.rolodexClient
  }

  get authVerifier(): AuthVerifier {
    return this.opts.authVerifier
  }

  get featureGatesClient(): FeatureGatesClient {
    return this.opts.featureGatesClient
  }

  get blobDispatcher(): Dispatcher {
    return this.opts.blobDispatcher
  }

  get kwsClient(): KwsClient | undefined {
    return this.opts.kwsClient
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
