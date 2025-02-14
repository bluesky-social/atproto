import { AtpAgent } from '@atproto/api'
import { Keypair } from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import { IncomingMessage } from 'http'

import { AuthVerifier, Creds } from './auth-verifier'
import { BsyncClient } from './bsync'
import { ServerConfig } from './config'
import { CourierClient } from './courier'
import { DataPlaneClient, withHeaders } from './data-plane/client'
import { FeatureGates } from './feature-gates'
import { HandlerRequestContext, HydrateCtx } from './hydration/hydrate-ctx'
import { Hydrator } from './hydration/hydrator'
import { httpLogger as log } from './logger'
import {
  Awaitable,
  createPipeline,
  HandlerOutput,
  HydrationFn,
  PresentationFn,
  RulesFn,
  SkeletonFn,
} from './pipeline'
import {
  defaultLabelerHeader,
  ParsedLabelers,
  parseLabelerHeader,
} from './util/labeler-header'
import { Views } from './views/index'

export type CreateHydrateCtxOptions = {
  /**
   * Use the credential's "include3pBlocks" value when building the
   * {@link HydrateCtxVals} use to instantiate the {@link HydrateCtx}
   */
  include3pBlocks?: boolean

  /**
   * Use the credential's "includeTakedowns" value when building the
   * {@link HydrateCtxVals} use to instantiate the {@link HydrateCtx}
   */
  includeTakedowns?: boolean
}

export type CreateHandlerOptions = CreateHydrateCtxOptions & {
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
      courierClient: CourierClient | undefined
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

  get courierClient(): CourierClient | undefined {
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

  private dataplaneForCaller(auth: Creds): DataPlaneClient {
    // Optimization: avoid creating a new client. Simply create a "proxy" that
    // adds the did header, or return the global data plane client if there
    // is no did.
    if (
      auth.credentials.type === 'standard' ||
      auth.credentials.type === 'mod_service'
    ) {
      const did = serviceRefToDid(auth.credentials.iss)
      return withHeaders(this.opts.dataplane, { 'bsky-caller-did': did })
    } else {
      return this.opts.dataplane
    }
  }

  /**
   * Creates a new HydrateCtx instance that wraps an XrpcServer request context,
   * and includes a user bound dataplane client and hydrator, as well as
   * additional services used in XRPC method handlers. The HydrateCtx instance
   * exposes the useful request context properties and methods, as well as the
   * bound services.
   */
  public async createHydrateCtx<Params, Auth extends Creds, Input>(
    reqCtx: HandlerRequestContext<Params, Auth, Input>,
    options?: CreateHydrateCtxOptions,
  ) {
    const { auth } = reqCtx
    const dataplane = this.dataplaneForCaller(auth)

    // @TODO Refactor the Hydrator and HydrateCtx into a single class. For
    // historic reasons, "hydrator" used to be a singleton. Then we added the
    // ability to send the caller DID to the data plane, which required to
    // create a new dataplane instance (and thus a new hydrator) per request.
    // Since the hydrator is now bound the the viewer, we should merge the two
    // classes.

    const hydrator = new Hydrator(dataplane, this.cfg.labelsFromIssuerDids)

    const includeTakedownsAnd3pBlocks =
      (auth.credentials.type === 'role' && auth.credentials.admin) ||
      auth.credentials.type === 'mod_service' ||
      (auth.credentials.type === 'standard' &&
        this.authVerifier.isModService(auth.credentials.iss))

    const include3pBlocks = options?.include3pBlocks
      ? includeTakedownsAnd3pBlocks
      : false

    const includeTakedowns = options?.includeTakedowns
      ? includeTakedownsAnd3pBlocks
      : false

    const labelers = await hydrator.filterUnavailableLabelers(
      this.reqLabelers(reqCtx.req),
      includeTakedowns,
    )

    return new HydrateCtx<Params, Auth, Input>(
      reqCtx,
      { labelers, include3pBlocks, includeTakedowns },
      dataplane,
      hydrator,
      this.opts.views,
      this.cfg,
      this.opts.featureGates,
      this.opts.bsyncClient,
      this.opts.idResolver,
      this.opts.suggestionsAgent,
      this.opts.searchAgent,
      this.opts.courierClient,
    )
  }

  /**
   * Utility that allows creating an XRPC method handler that works with an
   * HydrateCtx instance instead of an XrpcServer request context. The utility
   * will handle the creation of the Hydrate context, and will expose the
   * labelers, and optionally the repo revision, in the response headers before
   * invoking the handler with the HydrateCtx instance.
   */
  createHandler<
    Params,
    Auth extends Creds,
    Input,
    Output extends void | HandlerOutput<unknown>,
  >(
    handler: (ctx: HydrateCtx<Params, Auth, Input>) => Awaitable<Output>,
    { exposeRepoRev = false, ...options }: CreateHandlerOptions = {},
  ) {
    return async (
      reqCtx: HandlerRequestContext<Params, Auth, Input>,
    ): Promise<Output> => {
      const hydrateCtx = await this.createHydrateCtx(reqCtx, options)

      hydrateCtx.setLabelersHeader()

      if (exposeRepoRev) await hydrateCtx.setRepoRevHeader()

      return handler(hydrateCtx)
    }
  }

  createPipelineHandler<Skeleton, Params, Auth extends Creds, Input, Output>(
    skeletonFn: SkeletonFn<Skeleton, Params, Auth, Input>,
    hydrationFn: HydrationFn<Skeleton, Params, Auth, Input>,
    rulesFn: RulesFn<Skeleton, Params, Auth, Input>,
    presentationFn: PresentationFn<Skeleton, Params, Output>,
    options: CreateHandlerOptions = {},
  ) {
    const pipeline = createPipeline<Skeleton, Params, Auth, Input, Output>(
      skeletonFn,
      hydrationFn,
      rulesFn,
      presentationFn,
    )

    return this.createHandler(pipeline, options)
  }
}

export default AppContext

// service refs may look like "did:plc:example#service_id". we want to extract the did part "did:plc:example".
function serviceRefToDid(serviceRef: string) {
  const idx = serviceRef.indexOf('#')
  return idx !== -1 ? serviceRef.slice(0, idx) : serviceRef
}
