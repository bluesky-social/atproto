import {
  CachedHandleResolver,
  type HandleCache,
} from './cached-handle-resolver.js'
import type { HandleResolver } from './types.js'
import {
  XrpcHandleResolver,
  type XrpcHandleResolverOptions,
} from './xrpc-handle-resolver.js'

export type CreateHandleResolverOptions = {
  handleResolver: URL | string | HandleResolver
  handleCache?: HandleCache
} & Partial<XrpcHandleResolverOptions>

export function createHandleResolver(
  options: CreateHandleResolverOptions,
): HandleResolver {
  const { handleResolver, handleCache } = options

  if (handleResolver instanceof CachedHandleResolver && !handleCache) {
    return handleResolver
  }

  return new CachedHandleResolver(
    typeof handleResolver === 'string' || handleResolver instanceof URL
      ? new XrpcHandleResolver(handleResolver, options)
      : handleResolver,
    handleCache,
  )
}
