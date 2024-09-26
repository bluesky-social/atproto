import { AtpAgent } from '@atproto/api'
import { Keypair } from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import { IncomingMessage } from 'http'

import { resHeaders } from './api/util.js'
import { AuthVerifier } from './auth-verifier.js'
import { BsyncClient } from './bsync.js'
import { ServerConfig } from './config.js'
import { CourierClient } from './courier.js'
import { DataPlaneClient, withHeaders } from './data-plane/client.js'
import { FeatureGates } from './feature-gates.js'
import { HydrateCtx, HydrateCtxVals } from './hydration/hydrate-ctx.js'
import { Hydrator } from './hydration/hydrator.js'
import { httpLogger as log } from './logger.js'
import {
  Awaitable,
  createPipeline,
  HandlerContext,
  HandlerOutput,
  HandlerRequestContext,
  HydrationFn,
  PipelineOptions,
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
import { AuthRequiredError } from '@atproto/xrpc-server'

export type HandlerFactoryOptions = {
  /**
   * Expose the current repo revision in the response headers.
   */
  exposeRepoRev?: boolean

  /**
   * Expose the labelers that were used to generate the response.
   */
  exposeLabelers?: boolean

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

  /**
   * Causes an error if the `canPerformTakedown` field is not present in the
   * credential.
   */
  enforceCanPerformTakedown?: boolean
}

export class AppContext {
  constructor(
    private opts: {
      cfg: ServerConfig
      dataplane: DataPlaneClient
      searchAgent: AtpAgent | undefined
      suggestionsAgent: AtpAgent | undefined
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

  /**
   * Global data plane client that is not scoped to any particular viewer.
   */
  get dataplane(): DataPlaneClient {
    return this.opts.dataplane
  }

  get signingKey(): Keypair {
    return this.opts.signingKey
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

  dataplaneForViewer(viewer: null | string): DataPlaneClient {
    if (viewer) {
      return withHeaders(this.opts.dataplane, { 'bsky-caller-did': viewer })
    } else {
      return this.opts.dataplane
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
    const dataplane = this.dataplaneForViewer(vals.viewer)

    // @TODO Refactor the Hydrator, HydrateCtx and HandlerContext into a single
    // class. For historic reasons, "hydrator" used to be a singleton. Then we
    // added the ability to send the caller DID to the data plane, which
    // required to create a new dataplane instance per request.

    const hydrator = new Hydrator(dataplane, this.cfg.labelsFromIssuerDids)

    // ensures we're only apply labelers that exist and are not taken down
    const labelers = vals.labelers.dids
    const nonServiceLabelers = labelers.filter(
      (did) => !hydrator.serviceLabelers.has(did),
    )
    const labelerActors = await hydrator.actor.getActors(
      nonServiceLabelers,
      vals.includeTakedowns,
    )
    const availableDids = labelers.filter(
      (did) => hydrator.serviceLabelers.has(did) || !!labelerActors.get(did),
    )
    const availableLabelers = {
      dids: availableDids,
      redact: vals.labelers.redact,
    }

    const hydrateCtx = new HydrateCtx({
      labelers: availableLabelers,
      viewer: vals.viewer,
      includeTakedowns: vals.includeTakedowns,
      include3pBlocks: vals.include3pBlocks,
    })

    return {
      hydrateCtx,
      hydrator,
      dataplane,
      cfg: this.opts.cfg,
      views: this.opts.views,
      suggestionsAgent: this.opts.suggestionsAgent,
      searchAgent: this.opts.searchAgent,
      idResolver: this.opts.idResolver,
      featureGates: this.opts.featureGates,
      bsyncClient: this.opts.bsyncClient,
    }
  }

  createHandler<
    ReqCtx extends HandlerRequestContext<unknown>,
    Output extends void | HandlerOutput<unknown>,
  >(
    view: (ctx: HandlerContext, reqCtx: ReqCtx) => Awaitable<Output>,
    {
      exposeRepoRev = false,
      exposeLabelers = true,
      allowIncludeTakedowns = false,
      allowInclude3pBlocks = false,
      enforceCanPerformTakedown = false,
    }: HandlerFactoryOptions = {},
  ) {
    const { authVerifier } = this

    /**
     * Returns an XRPC handler that wraps the view function.
     */
    return async (reqCtx: ReqCtx): Promise<Output> => {
      const labelers = this.reqLabelers(reqCtx.req)
      const { viewer, includeTakedowns, include3pBlocks, canPerformTakedown } =
        authVerifier.parseCreds(reqCtx.auth)

      if (enforceCanPerformTakedown && !canPerformTakedown) {
        throw new AuthRequiredError(
          'Must be a full moderator to update subject state',
        )
      }

      const ctx = await this.createHandlerContext({
        labelers,
        viewer,
        includeTakedowns: allowIncludeTakedowns ? includeTakedowns : undefined,
        include3pBlocks: allowInclude3pBlocks ? include3pBlocks : undefined,
      })

      const output = await view(ctx, reqCtx)

      return output
        ? ({
            encoding: output.encoding,
            headers: {
              ...output.headers,
              ...resHeaders({
                repoRev: exposeRepoRev
                  ? await ctx.hydrator.actor.getRepoRevSafe(
                      ctx.hydrateCtx.viewer,
                    )
                  : undefined,
                labelers: exposeLabelers ? ctx.hydrateCtx.labelers : undefined,
              }),
            },
            body: output.body,
          } as Output)
        : (undefined as Output)
    }
  }

  createPipelineHandler<Params, View, Skeleton>(
    skeletonFn: SkeletonFn<Skeleton, Params>,
    hydrationFn: HydrationFn<Skeleton, Params>,
    rulesFn: RulesFn<Skeleton, Params>,
    presentationFn: PresentationFn<Skeleton, Params, View>,
    options: PipelineOptions<Skeleton, Params> & HandlerFactoryOptions = {},
  ) {
    const pipeline = createPipeline(
      skeletonFn,
      hydrationFn,
      rulesFn,
      presentationFn,
      options,
    )

    return this.createHandler(pipeline, options)
  }
}

export default AppContext
