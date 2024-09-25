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
  HydrationFn,
  PipelineOptions,
  PresentationFn,
  HandlerContext,
  RulesFn,
  SkeletonFn,
  Awaitable,
} from './pipeline.js'
import {
  defaultLabelerHeader,
  ParsedLabelers,
  parseLabelerHeader,
} from './util.js'
import { Views } from './views/index.js'
import { resHeaders } from './api/util.js'

export type DefaultHeadersOptions = {
  /**
   * Expose the current repo revision in the response headers.
   */
  exposeRepoRev?: boolean

  /**
   * Expose the labelers that were used to generate the response.
   */
  exposeLabelers?: boolean
}

export async function defaultHeaders(
  ctx: HandlerContext,
  options?: DefaultHeadersOptions,
) {
  return resHeaders({
    repoRev:
      options?.exposeRepoRev === true
        ? await ctx.hydrator.actor.getRepoRevSafe(ctx.hydrateCtx.viewer)
        : undefined,
    labelers:
      options?.exposeLabelers !== false ? ctx.hydrateCtx.labelers : undefined,
  })
}

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

  async createHandlerContext(vals: HydrateCtxVals): Promise<HandlerContext> {
    const { dataplane, hydrator } = this.dataplaneForViewer(vals.viewer)
    return {
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

  createHandler<
    ReqCtx extends {
      auth: Creds
      params: unknown
      req: IncomingMessage
      res: ServerResponse
    },
    Output extends void | {
      body: unknown
      headers?: Record<string, string>
      encoding: 'application/json'
    },
  >(
    view: (ctx: HandlerContext, reqCtx: ReqCtx) => Awaitable<Output>,
    options: DefaultHeadersOptions &
      HandlerFactoryOptions & {
        onPipelineError?: (
          ctx: HandlerContext,
          reqCtx: ReqCtx,
          err: unknown,
        ) => Promise<Output>
      } = {},
  ) {
    const {
      allowIncludeTakedowns = false,
      allowInclude3pBlocks = false,
      onPipelineError,
    } = options

    return async (reqCtx: ReqCtx): Promise<Output> => {
      const creds = this.authVerifier.parseCreds(reqCtx.auth)
      const labelers = this.reqLabelers(reqCtx.req)

      const ctx = await this.createHandlerContext({
        viewer: creds.viewer,
        labelers,
        includeTakedowns: allowIncludeTakedowns
          ? creds.includeTakedowns
          : undefined,
        include3pBlocks: allowInclude3pBlocks
          ? creds.include3pBlocks
          : undefined,
      })

      const result = await Promise.resolve(view(ctx, reqCtx)).catch(
        onPipelineError ? (err) => onPipelineError(ctx, reqCtx, err) : null,
      )

      if (!result) return undefined as Output

      return {
        encoding: result.encoding,
        headers: {
          ...result.headers,
          ...(await defaultHeaders(ctx, options)),
        },
        body: result.body,
      } as Output
    }
  }

  createPipelineHandler<Params, View, Skeleton, Auth extends Creds>(
    skeletonFn: SkeletonFn<Skeleton, Params>,
    hydrationFn: HydrationFn<Skeleton, Params>,
    rulesFn: RulesFn<Skeleton, Params>,
    presentationFn: PresentationFn<Skeleton, Params, View>,
    options: PipelineOptions<Skeleton, Params> &
      DefaultHeadersOptions &
      HandlerFactoryOptions & {
        /**
         * Parse incoming headers and expose the result to the pipeline
         */
        parseHeaders?: (
          req: IncomingMessage,
        ) => Record<string, undefined | string>

        onPipelineError?: (
          ctx: HandlerContext,
          reqCtx: {
            auth: Auth
            params: Params
            req: IncomingMessage
            res: ServerResponse
          },
          err: unknown,
        ) => Promise<{
          body: View
          headers?: Record<string, string>
          encoding: 'application/json'
        }>
      } = {},
  ) {
    const { parseHeaders } = options

    const pipeline = createPipeline(
      skeletonFn,
      hydrationFn,
      rulesFn,
      presentationFn,
      options,
    )

    return this.createHandler(
      (
        ctx,
        reqCtx: {
          auth: Auth
          params: Params
          req: IncomingMessage
          res: ServerResponse
        },
      ) => {
        return pipeline(
          ctx,
          reqCtx.params,
          parseHeaders && noUndefinedVals(parseHeaders(reqCtx.req)),
        )
      },
    )
  }
}

export default AppContext
