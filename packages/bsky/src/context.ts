import { AtpAgent } from '@atproto/api'
import { Keypair } from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import * as plc from '@did-plc/lib'

import { IncomingMessage } from 'http'
import { AuthVerifier, Creds } from './auth-verifier.js'
import { BsyncClient } from './bsync.js'
import { ServerConfig } from './config.js'
import { CourierClient } from './courier.js'
import { DataPlaneClient, withHeaders } from './data-plane/client.js'
import { FeatureGates } from './feature-gates.js'
import { HydrateCtxVals, Hydrator } from './hydration/hydrator.js'
import { httpLogger as log } from './logger.js'
import {
  createPipeline,
  defaultHeaders,
  DefaultHeadersOptions,
  HydrationFn,
  PipelineOptions,
  PresentationFn,
  RequestContext,
  RulesFn,
  SkeletonFn,
} from './pipeline.js'
import {
  defaultLabelerHeader,
  ParsedLabelers,
  parseLabelerHeader,
} from './util.js'
import { Views } from './views/index.js'

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

  dataplaneForViewer(viewer: null | string) {
    if (viewer) {
      const dataplane = withHeaders(this.opts.dataplane, {
        'bsky-caller-did': viewer,
      })
      const hydrator = new Hydrator(dataplane, this.cfg.labelsFromIssuerDids)
      return { dataplane, hydrator }
    } else {
      return { dataplane: this.opts.dataplane, hydrator: this.opts.hydrator }
    }
  }

  reqLabelers(req: IncomingMessage): ParsedLabelers {
    const val = req.headers['atproto-accept-labelers']
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

  async createRequestContent(vals: HydrateCtxVals): Promise<RequestContext> {
    const { dataplane, hydrator } = this.dataplaneForViewer(vals.viewer)
    return {
      hydrateCtx: await hydrator.createContext(vals),
      hydrator,
      dataplane,
      views: this.views,
      suggestionsAgent: this.suggestionsAgent,
      searchAgent: this.searchAgent,
      featureGates: this.featureGates,
    }
  }

  createHandler<Auth extends Creds, Params, View>(
    view: (ctx: RequestContext, params: Params) => View | PromiseLike<View>,
    options?: DefaultHeadersOptions,
  ) {
    return async ({
      auth,
      params,
      req,
    }: {
      auth: Auth
      params: Params
      req: IncomingMessage
    }): Promise<{
      body: View
      headers?: Record<string, string>
      encoding: 'application/json'
    }> => {
      const viewer = auth.credentials.iss
      const labelers = this.reqLabelers(req)

      const ctx = await this.createRequestContent({
        viewer,
        labelers,
      })

      const body = await view(ctx, params)

      return {
        encoding: 'application/json',
        headers: await defaultHeaders(ctx, options),
        body,
      }
    }
  }

  createPipelineHandler<Auth extends Creds, Params, View, Skeleton>(
    skeletonFn: SkeletonFn<Skeleton, Params>,
    hydrationFn: HydrationFn<Skeleton, Params>,
    rulesFn: RulesFn<Skeleton, Params>,
    presentationFn: PresentationFn<Skeleton, Params, View>,
    options?: PipelineOptions<Skeleton, Params>,
  ) {
    const pipeline = this.createPipeline(
      skeletonFn,
      hydrationFn,
      rulesFn,
      presentationFn,
      options,
    )

    return async ({
      auth,
      params,
      req,
    }: {
      auth: Auth
      params: Params
      req: IncomingMessage
    }): Promise<{
      body: View
      headers?: Record<string, string>
      encoding: 'application/json'
    }> => {
      const { viewer } = this.authVerifier.parseCreds(auth)
      const labelers = this.reqLabelers(req)

      return pipeline({ viewer, labelers }, params)
    }
  }

  createPipeline<Skeleton, Params, View>(
    skeletonFn: SkeletonFn<Skeleton, Params>,
    hydrationFn: HydrationFn<Skeleton, Params>,
    rulesFn: RulesFn<Skeleton, Params>,
    presentationFn: PresentationFn<Skeleton, Params, View>,
    options?: PipelineOptions<Skeleton, Params>,
  ) {
    const pipeline = createPipeline(
      skeletonFn,
      hydrationFn,
      rulesFn,
      presentationFn,
      options,
    )

    return async (
      vals: HydrateCtxVals,
      params: Params,
      headers?: Record<string, string>,
    ): Promise<{
      body: View
      headers?: Record<string, string>
      encoding: 'application/json'
    }> => {
      const ctx = await this.createRequestContent(vals)
      return pipeline(ctx, params, headers)
    }
  }
}

export default AppContext
