import { AtpAgent } from '@atproto/api'
import { Keypair } from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import { IncomingMessage } from 'http'

import { AuthRequiredError } from '@atproto/xrpc-server'
import { ATPROTO_CONTENT_LABELERS, ATPROTO_REPO_REV } from './api/util'
import { AuthVerifier, Creds } from './auth-verifier'
import { BsyncClient } from './bsync'
import { ServerConfig } from './config'
import { CourierClient } from './courier'
import { DataPlaneClient, withHeaders } from './data-plane/client'
import { FeatureGates } from './feature-gates'
import { HydrateCtx, HydrateCtxVals } from './hydration/hydrate-ctx'
import { Hydrator } from './hydration/hydrator'
import { httpLogger as log } from './logger'
import {
  Awaitable,
  createPipeline,
  HandlerOutput,
  HandlerRequestContext,
  HydrationFn,
  PipelineOptions,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from './pipeline'
import {
  defaultLabelerHeader,
  formatLabelerHeader,
  ParsedLabelers,
  parseLabelerHeader,
} from './util/labeler-header'
import { Views } from './views/index'

export type CreateHandlerOptions = {
  /**
   * Use the credential's "include3pBlocks" value when building the
   * {@link HydrateCtxVals} use to instantiate the {@link HydrateCtx}
   */
  allowInclude3pBlocks?: boolean

  /**
   * Use the credential's "includeTakedowns" value when building the
   * {@link HydrateCtxVals} use to instantiate the {@link HydrateCtx}
   */
  allowIncludeTakedowns?: boolean

  /**
   * Causes an error if the `canPerformTakedown` field is not present in the
   * credential.
   */
  canPerformTakedownRequired?: boolean

  /**
   * Expose the current repo revision in the response headers.
   */
  exposeRepoRev?: boolean
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

  /**
   * @deprecated (used in tests)
   */
  get views(): Views {
    return this.opts.views
  }

  /**
   * @deprecated (used by dev-env)
   */
  get idResolver(): IdResolver {
    return this.opts.idResolver
  }

  private reqLabelers(req: IncomingMessage): ParsedLabelers {
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

  private dataplaneForViewer(viewer: null | string): DataPlaneClient {
    // Optimization: avoid creating a new client. Simply create a "proxy" that
    // adds the viewer header, or return the global data plane client if there
    // is no viewer.
    if (viewer) {
      return withHeaders(this.opts.dataplane, { 'bsky-caller-did': viewer })
    } else {
      return this.opts.dataplane
    }
  }

  private async createHydrateCtx(vals: HydrateCtxVals): Promise<HydrateCtx> {
    const dataplane = this.dataplaneForViewer(vals.viewer)

    // @TODO Refactor the Hydrator and HydrateCtx into a single class. For
    // historic reasons, "hydrator" used to be a singleton. Then we added the
    // ability to send the caller DID to the data plane, which required to
    // create a new dataplane instance (and thus a new hydrator) per request.
    // Since the hydrator is now bound the the viewer, we should merge the two
    // classes.

    const hydrator = new Hydrator(dataplane, this.cfg.labelsFromIssuerDids)

    const availableLabelers = await hydrator.filterUnavailableLabelers(
      vals.labelers,
      vals.includeTakedowns,
    )

    return new HydrateCtx(
      { ...vals, labelers: availableLabelers },
      dataplane,
      hydrator,
      this.opts.views,
      this.cfg,
      this.opts.featureGates,
      this.opts.bsyncClient,
      this.opts.idResolver,
      this.opts.suggestionsAgent,
      this.opts.searchAgent,
    )
  }

  createHandler<
    ReqCtx extends HandlerRequestContext<unknown>,
    Output extends void | HandlerOutput<unknown>,
  >(
    view: (ctx: HydrateCtx, reqCtx: ReqCtx) => Awaitable<Output>,
    options: CreateHandlerOptions = {},
  ) {
    const { authVerifier } = this
    const {
      // Store as const to allow code path optimizations by compiler
      allowInclude3pBlocks = false,
      allowIncludeTakedowns = false,
      canPerformTakedownRequired = false,
      exposeRepoRev = false,
    } = options

    /**
     * Returns an XRPC handler that wraps the view function.
     */
    return async (reqCtx: ReqCtx): Promise<Output> => {
      const credentials = authVerifier.parseCreds(reqCtx.auth)

      if (canPerformTakedownRequired && !credentials.canPerformTakedown) {
        throw new AuthRequiredError('Must be a full moderator')
      }

      const ctx = await this.createHydrateCtx({
        labelers: this.reqLabelers(reqCtx.req),
        viewer: credentials.viewer,
        include3pBlocks: allowInclude3pBlocks && credentials.include3pBlocks,
        includeTakedowns: allowIncludeTakedowns && credentials.includeTakedowns,
      })

      try {
        return await view(ctx, reqCtx)
      } finally {
        const { res } = reqCtx

        res.setHeader(
          ATPROTO_CONTENT_LABELERS,
          formatLabelerHeader(ctx.labelers),
        )

        if (exposeRepoRev) {
          const repoRev = await ctx.hydrator.actor.getRepoRevSafe(ctx.viewer)
          if (repoRev) {
            res.setHeader(ATPROTO_REPO_REV, repoRev)
          }
        }
      }
    }
  }

  createPipelineHandler<Skeleton, Params, View, Auth extends Creds = Creds>(
    skeletonFn: SkeletonFn<Skeleton, Params>,
    hydrationFn: HydrationFn<Skeleton, Params>,
    rulesFn: RulesFn<Skeleton, Params>,
    presentationFn: PresentationFn<Skeleton, Params, View>,
    options: PipelineOptions<Skeleton, Params, Auth> &
      CreateHandlerOptions = {},
  ) {
    const pipeline = createPipeline<Skeleton, Params, View, Auth>(
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
