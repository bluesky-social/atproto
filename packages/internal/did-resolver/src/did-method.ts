import { Did, DidDocument } from '@atproto/did'

export type ResolveDidOptions = {
  signal?: AbortSignal
  noCache?: boolean
}

export interface DidMethod<Method extends string> {
  resolve: (
    did: Did<Method>,
    options?: ResolveDidOptions,
  ) => DidDocument | PromiseLike<DidDocument>
}

export type DidMethods<M extends string> = {
  [K in M]: DidMethod<K>
}
