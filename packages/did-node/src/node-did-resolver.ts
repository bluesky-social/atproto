import {
  IsomorphicDidResolver,
  IsomorphicDidResolverOptions,
} from '@atproto-labs/did'
import { safeFetchWrap } from '@atproto-labs/fetch-node'

export type NodeDidResolverOptions = IsomorphicDidResolverOptions & {
  dangerouslyDisableSafeFetch?: boolean
}

export class NodeDidResolver extends IsomorphicDidResolver {
  constructor({
    dangerouslyDisableSafeFetch = false,
    fetch,
    ...options
  }: NodeDidResolverOptions = {}) {
    super({
      fetch:
        dangerouslyDisableSafeFetch === true ? fetch : safeFetchWrap({ fetch }),
      ...options,
    })
  }
}
