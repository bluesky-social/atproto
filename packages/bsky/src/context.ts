import { AtpAgent } from '@atproto/api'
import { Keypair } from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import * as plc from '@did-plc/lib'
import express from 'express'

import { AuthVerifier } from './auth-verifier.js'
import { BsyncClient } from './bsync.js'
import { ServerConfig } from './config.js'
import { CourierClient } from './courier.js'
import { createDataPlaneClient, DataPlaneClient } from './data-plane/client.js'
import { FeatureGates } from './feature-gates.js'
import { HydrateCtx, Hydrator } from './hydration/hydrator.js'
import { httpLogger as log } from './logger.js'
import {
  createPipeline,
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from './pipeline.js'
import {
  defaultLabelerHeader,
  ParsedLabelers,
  parseLabelerHeader,
} from './util.js'
import { Views } from './views/index.js'

export type AppPipelineContext<
  H extends { viewer: null | string } = HydrateCtx,
> = {
  hydrateCtx: H
  hydrator: Hydrator
  views: Views
  dataplane: DataPlaneClient
  suggestionsAgent?: AtpAgent
  searchAgent?: AtpAgent
  featureGates: FeatureGates
}

export class AppContext {
  constructor(
    private opts: {
      cfg: ServerConfig
      dataplane: DataPlaneClient
      searchAgent: AtpAgent | undefined
      suggestionsAgent: AtpAgent | undefined
      hydrator: Hydrator
      views: Views
      signingKey: Keypair
      idResolver: IdResolver
      bsyncClient: BsyncClient
      courierClient: CourierClient
      authVerifier: AuthVerifier
      featureGates: FeatureGates
    },
  ) {}

  get cfg(): ServerConfig {
    return this.opts.cfg
  }

  get dataplane(): DataPlaneClient {
    return this.opts.dataplane
  }

  get searchAgent(): AtpAgent | undefined {
    return this.opts.searchAgent
  }

  get suggestionsAgent(): AtpAgent | undefined {
    return this.opts.suggestionsAgent
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

  get courierClient(): CourierClient {
    return this.opts.courierClient
  }

  get authVerifier(): AuthVerifier {
    return this.opts.authVerifier
  }

  get featureGates(): FeatureGates {
    return this.opts.featureGates
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

  createPipeline<
    Params,
    Skeleton,
    View,
    H extends { viewer: null | string } = HydrateCtx,
  >(
    skeletonFn: SkeletonFn<AppPipelineContext<H>, Params, Skeleton>,
    hydrationFn: HydrationFn<AppPipelineContext<H>, Params, Skeleton>,
    rulesFn: RulesFn<AppPipelineContext<H>, Params, Skeleton>,
    presentationFn: PresentationFn<
      AppPipelineContext<H>,
      Params,
      Skeleton,
      View
    >,
  ) {
    const {
      cfg: config,
      hydrator: globalHydrator,
      dataplane: globalDataplane,
      views,
      suggestionsAgent,
      searchAgent,
      featureGates,
    } = this

    const pipeline = createPipeline(
      skeletonFn,
      hydrationFn,
      rulesFn,
      presentationFn,
    )

    const buildContext = (hydrateCtx: H): AppPipelineContext<H> => {
      if (hydrateCtx.viewer) {
        const dataplane = createDataPlaneClient(config.dataplaneUrls, {
          httpVersion: config.dataplaneHttpVersion,
          rejectUnauthorized: !config.dataplaneIgnoreBadTls,
        })
        const hydrator = new Hydrator(dataplane, config.labelsFromIssuerDids)

        return {
          hydrateCtx,
          hydrator,
          dataplane: dataplane.clearActorMutes(
            { actorDid: hydrateCtx.viewer },
            {
              httpVersion,
            },
          ),
          views,
          suggestionsAgent,
          searchAgent,
          featureGates,
        }
      } else {
        return {
          hydrateCtx,
          hydrator: globalHydrator,
          dataplane: globalDataplane,
          views,
          suggestionsAgent,
          searchAgent,
          featureGates,
        }
      }
    }

    return async (
      hydrateCtx: H,
      params: Params,
      headers: Record<string, string> = {},
    ) => {
      const ctx = buildContext(hydrateCtx)
      return pipeline(ctx, params, headers)
    }
  }
}

export default AppContext
