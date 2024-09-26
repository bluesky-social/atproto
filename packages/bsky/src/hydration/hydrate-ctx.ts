import { AtpAgent } from '@atproto/api'
import { IdResolver } from '@atproto/identity'

import type { BsyncClient } from '../bsync'
import type { ServerConfig } from '../config'
import type { DataPlaneClient } from '../data-plane/index'
import type { FeatureGates } from '../feature-gates'
import type { ParsedLabelers } from '../util'
import type { Views } from '../views/index'
import type { Hydrator } from './hydrator'

export class HydrateCtx {
  labelers = this.vals.labelers
  viewer = this.vals.viewer !== null ? serviceRefToDid(this.vals.viewer) : null
  includeTakedowns = this.vals.includeTakedowns
  include3pBlocks = this.vals.include3pBlocks

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

export type HydrateCtxVals = {
  labelers: ParsedLabelers
  viewer: string | null
  includeTakedowns?: boolean
  include3pBlocks?: boolean
}

// service refs may look like "did:plc:example#service_id". we want to extract the did part "did:plc:example".
export function serviceRefToDid(serviceRef: string) {
  const idx = serviceRef.indexOf('#')
  return idx !== -1 ? serviceRef.slice(0, idx) : serviceRef
}
