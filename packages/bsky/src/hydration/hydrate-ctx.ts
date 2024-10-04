import type { AtpAgent } from '@atproto/api'
import type { IdResolver } from '@atproto/identity'
import type { Request, Response } from 'express'
import type { IncomingHttpHeaders } from 'node:http'

import type { Creds } from '../auth-verifier'
import type { BsyncClient } from '../bsync'
import type { ServerConfig } from '../config'
import type { DataPlaneClient } from '../data-plane/index'
import type { FeatureGates } from '../feature-gates'
import type { ParsedLabelers } from '../util/labeler-header'
import type { Views } from '../views/index'
import type { Hydrator } from './hydrator'

import { ATPROTO_CONTENT_LABELERS, ATPROTO_REPO_REV } from '../api/util'
import { formatLabelerHeader } from '../util/labeler-header'

export type HandlerRequestContext<
  Params = unknown,
  Auth extends Creds = Creds,
  Input = unknown,
> = {
  auth: Auth
  params: Params
  input: Input
  req: Request
  res: Response
}

export type HydrateCtxVals = {
  labelers: ParsedLabelers
  includeTakedowns: boolean
  include3pBlocks: boolean
}

export class HydrateCtx<
  Params = unknown,
  Auth extends Creds = Creds,
  Input = unknown,
> {
  constructor(
    private reqCtx: HandlerRequestContext<Params, Auth, Input>,
    private vals: HydrateCtxVals,
    readonly dataplane: DataPlaneClient,
    readonly hydrator: Hydrator,
    readonly views: Views,
    readonly cfg: ServerConfig,
    readonly featureGates: FeatureGates,
    readonly bsyncClient: BsyncClient,
    readonly idResolver: IdResolver,
    readonly suggestionsAgent: AtpAgent | undefined,
    readonly searchAgent: AtpAgent | undefined,
  ) {}

  get labelers(): ParsedLabelers {
    return this.vals.labelers
  }

  get viewer(): Viewer<Auth> {
    return viewer(this.auth)
  }

  get includeTakedowns(): boolean {
    return this.vals.includeTakedowns
  }

  get include3pBlocks(): boolean {
    return this.vals.include3pBlocks
  }

  get params(): Params {
    return this.reqCtx.params
  }

  get input(): Input {
    return this.reqCtx.input
  }

  get auth(): Auth {
    return this.reqCtx.auth
  }

  get headers(): IncomingHttpHeaders {
    return this.reqCtx.req.headers
  }

  get hostname(): string {
    return this.reqCtx.req.hostname
  }

  copy(vals?: Partial<HydrateCtxVals>) {
    return new HydrateCtx(
      this.reqCtx,
      { ...this.vals, ...vals },
      this.dataplane,
      this.hydrator,
      this.views,
      this.cfg,
      this.featureGates,
      this.bsyncClient,
      this.idResolver,
      this.suggestionsAgent,
      this.searchAgent,
    )
  }

  setLabelersHeader() {
    this.reqCtx.res.setHeader(
      ATPROTO_CONTENT_LABELERS,
      formatLabelerHeader(this.labelers),
    )
  }

  async setRepoRevHeader() {
    if (this.viewer) {
      const repoRev = await this.hydrator.actor.getRepoRevSafe(this.viewer)
      if (repoRev) this.reqCtx.res.setHeader(ATPROTO_REPO_REV, repoRev)
    }
  }
}

export type Viewer<Auth extends Creds> = Auth extends {
  credentials: { type: 'standard' }
}
  ? Auth['credentials']['iss']
  : null
export const viewer = <Auth extends Creds>(auth: Auth) =>
  (auth.credentials.type === 'standard'
    ? // @TODO: is there ever actually a service id in the "iss" when the type is "standard"?
      auth.credentials.iss.split('#')[0]
    : null) as Viewer<Auth>
