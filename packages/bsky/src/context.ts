import { AtpAgent } from '@atproto/api'
import { Keypair } from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import * as plc from '@did-plc/lib'

import { noUndefinedVals } from '@atproto/common'
import { IncomingMessage, ServerResponse } from 'http'
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

export type HandlerFactoryOptions = {
  /**
   * Use the credential's "includeTakedowns" value when building the
   * {@link HydrateCtxVals} (use to build the {@link HydrateCtx}).
   */
  allowIncludeTakedowns?: boolean

  /**
   * Use the credential's "include3pBlocks" value when building the
   * {@link HydrateCtxVals} (use to build the {@link HydrateCtx}).
   */
  allowInclude3pBlocks?: boolean
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

  async createRequestContent(
    req: IncomingMessage,
    res: ServerResponse,
    vals: HydrateCtxVals,
  ): Promise<RequestContext> {
    const { dataplane, hydrator } = this.dataplaneForViewer(vals.viewer)
    return {
      req,
      res,
      hydrateCtx: await hydrator.createContext(vals),
      hydrator,
      dataplane,
      views: this.views,
      suggestionsAgent: this.suggestionsAgent,
      searchAgent: this.searchAgent,
      featureGates: this.featureGates,
      bsyncClient: this.bsyncClient,
    }
  }

  createHandler<Auth extends Creds, Params, View>(
    view: (ctx: RequestContext, params: Params) => View | PromiseLike<View>,
    options: DefaultHeadersOptions & HandlerFactoryOptions = {},
  ) {
    const { allowIncludeTakedowns = false, allowInclude3pBlocks = false } =
      options

    return async ({
      auth,
      params,
      req,
      res,
    }: {
      auth: Auth
      params: Params
      req: IncomingMessage
      res: ServerResponse
    }): Promise<{
      body: View
      headers?: Record<string, string>
      encoding: 'application/json'
    }> => {
      const creds = this.authVerifier.parseCreds(auth)
      const labelers = this.reqLabelers(req)

      const ctx = await this.createRequestContent(req, res, {
        viewer: creds.viewer,
        labelers,
        includeTakedowns: allowIncludeTakedowns
          ? creds.includeTakedowns
          : undefined,
        include3pBlocks: allowInclude3pBlocks
          ? creds.include3pBlocks
          : undefined,
      })

      const body = await view(ctx, params)

      return {
        encoding: 'application/json',
        headers: await defaultHeaders(ctx, options),
        body,
      }
    }
  }

  createPipelineHandler<Params, View, Skeleton, Auth extends Creds>(
    skeletonFn: SkeletonFn<Skeleton, Params>,
    hydrationFn: HydrationFn<Skeleton, Params>,
    rulesFn: RulesFn<Skeleton, Params>,
    presentationFn: PresentationFn<Skeleton, Params, View>,
    options: PipelineOptions<Skeleton, Params, View> &
      HandlerFactoryOptions & {
        /**
         * Parse incoming headers and expose the result to the pipeline
         */
        parseHeaders?: (
          req: IncomingMessage,
        ) => Record<string, undefined | string>
      } = {},
  ) {
    const {
      allowIncludeTakedowns = false,
      allowInclude3pBlocks = false,
      parseHeaders,
    } = options

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
      const creds = this.authVerifier.parseCreds(auth)
      const labelers = this.reqLabelers(req)

      const vals: HydrateCtxVals = {
        viewer: creds.viewer,
        labelers,
        includeTakedowns: allowIncludeTakedowns
          ? creds.includeTakedowns
          : undefined,
        include3pBlocks: allowInclude3pBlocks
          ? creds.include3pBlocks
          : undefined,
      }

      const headers = parseHeaders && noUndefinedVals(parseHeaders(req))

      return pipeline(vals, params, headers)
    }
  }

  createPipeline<Skeleton, Params, View>(
    skeletonFn: SkeletonFn<Skeleton, Params>,
    hydrationFn: HydrationFn<Skeleton, Params>,
    rulesFn: RulesFn<Skeleton, Params>,
    presentationFn: PresentationFn<Skeleton, Params, View>,
    options?: PipelineOptions<Skeleton, Params, View>,
  ) {
    const pipeline = createPipeline(
      skeletonFn,
      hydrationFn,
      rulesFn,
      presentationFn,
      options,
    )

    return async (
      req: IncomingMessage,
      res: ServerResponse,
      vals: HydrateCtxVals,
      params: Params,
      headers?: Record<string, string>,
    ): Promise<{
      body: View
      headers?: Record<string, string>
      encoding: 'application/json'
    }> => {
      const ctx = await this.createRequestContent(req, res, vals)
      return pipeline(ctx, params, headers)
    }
  }
}

export default AppContext
