import { Did, DidDocument } from '@atproto/did'
import { ResolveDidOptions } from './did-method.js'

export type ResolvedDocument<D extends Did, M extends string = string> =
  D extends Did<infer N>
    ? DidDocument<N extends string ? M : N extends M ? N : never>
    : never

export interface DidResolver<M extends string = string> {
  resolve<D extends Did>(
    did: D,
    options?: ResolveDidOptions,
  ): Promise<ResolvedDocument<D, M>>
}
