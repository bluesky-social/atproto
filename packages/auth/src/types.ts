import * as ucan from '@ucans/core'

export interface Signer {
  sign: (data: Uint8Array) => Promise<Uint8Array>
}

export type CapWithProof = {
  cap: ucan.Capability
  prf: ucan.DelegationChain
}
