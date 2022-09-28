import * as ucans from '@ucans/core'

// const didExamplePlugin: ucans.DidMethodPlugin = {
//   checkJwtAlg: (did, jwtAlg) => {
//     return true
//   },
//   verifySignature: async (did, data, sig) => {
//     return true
//   },
// }

// export const didPlugins = new ucans.Plugins([p256Plugin], {
//   example: didExamplePlugin,
//   plc: didExamplePlugin, // @TODO write this plugin
// })
// import { Capability } from './capability'
// import { ValidateOptions, ValidateProofsOptions } from './token'
// import { DidableKey, Fact, Keypair, Ucan, UcanPayload } from './types'
// import {} from './'

export type BuildFn = (params: {
  // from/to
  issuer: ucans.DidableKey
  audience: string

  // capabilities
  capabilities?: Array<ucans.Capability>

  // time bounds
  lifetimeInSeconds?: number // expiration overrides lifetimeInSeconds
  expiration?: number
  notBefore?: number

  // proofs / other info
  facts?: Array<ucans.Fact>
  proofs?: Array<string>
  addNonce?: boolean
}) => Promise<ucans.Ucan>

export type SignFn = (
  payload: ucans.UcanPayload,
  jwtAlg: string,
  signFn: (data: Uint8Array) => Promise<Uint8Array>,
) => Promise<ucans.Ucan>

export type SignWithKeypairFn = (
  payload: ucans.UcanPayload,
  keypair: ucans.Keypair,
) => Promise<ucans.Ucan>

export type ValidateFn = (
  encodedUcan: string,
  opts?: Partial<ucans.ValidateOptions>,
) => Promise<ucans.Ucan>

export type ValidateProofsFn = (
  ucan: ucans.Ucan,
  opts?: Partial<ucans.ValidateProofsOptions>,
) => AsyncIterable<ucans.Ucan | Error>

export type VerifyFn = (
  ucan: string,
  options: ucans.VerifyOptions,
) => Promise<ucans.Result<ucans.Verification[], Error[]>>

export type DelegationChainsFn = (
  semantics: ucans.DelegationSemantics,
  ucan: ucans.Ucan,
  isRevoked?: (ucan: ucans.Ucan) => Promise<boolean>,
) => AsyncIterable<ucans.DelegationChain | Error>

export type BuilderClass = any
export type StoreClass = any

export type PluginInjectedApi = {
  build: BuildFn
  sign: SignFn
  signWithKeypair: SignWithKeypairFn
  validate: ValidateFn
  validateProofs: ValidateProofsFn
  verify: VerifyFn
  Builder: BuilderClass
  Store: StoreClass
  delegationChains: DelegationChainsFn
}
