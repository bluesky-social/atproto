import { ParsedLabelers } from '../util'

export class HydrateCtx {
  labelers = this.vals.labelers
  viewer = this.vals.viewer !== null ? serviceRefToDid(this.vals.viewer) : null
  includeTakedowns = this.vals.includeTakedowns
  include3pBlocks = this.vals.include3pBlocks

  constructor(private vals: HydrateCtxVals) {}

  copy<V extends Partial<HydrateCtxVals>>(vals?: V): HydrateCtx & V {
    return new HydrateCtx({ ...this.vals, ...vals }) as HydrateCtx & V
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
