import { AtpAgent } from '@atproto/api'
import { IdResolver } from '@atproto/identity'

import type { BsyncClient } from '../bsync'
import type { ServerConfig } from '../config'
import type { DataPlaneClient } from '../data-plane/index'
import type { FeatureGates } from '../feature-gates'
import type { ParsedLabelers } from '../util/labeler-header'
import type { Views } from '../views/index'
import type { Hydrator } from './hydrator'

export type HydrateCtxVals = {
  labelers: ParsedLabelers
  viewer: string | null
  includeTakedowns: boolean
  include3pBlocks: boolean
}

export class HydrateCtx {
  constructor(
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

  get viewer(): string | null {
    return this.vals.viewer
  }

  get includeTakedowns(): boolean {
    return this.vals.includeTakedowns
  }

  get include3pBlocks(): boolean {
    return this.vals.include3pBlocks
  }

  copy(vals?: Partial<HydrateCtxVals>) {
    return new HydrateCtx(
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
}
