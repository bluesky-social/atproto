import {
  CachedHandleResolver,
  type HandleCache,
  type HandleCacheErrorHandler,
  type HandleResolver,
} from '@atproto-labs/handle-resolver'
import {
  AtprotoHandleResolverNode,
  type AtprotoHandleResolverNodeOptions,
} from './atproto-handle-resolver-node.js'

export type CreateHandleResolverNodeOptions = {
  handleResolver?: HandleResolver
  handleCache?: HandleCache
  onHandleCacheError?: HandleCacheErrorHandler
} & Partial<AtprotoHandleResolverNodeOptions>

export function createHandleResolverNode(
  options: CreateHandleResolverNodeOptions,
) {
  const { handleResolver, handleCache, onHandleCacheError } = options

  if (handleResolver instanceof CachedHandleResolver && !handleCache) {
    return handleResolver
  }

  return new CachedHandleResolver(
    handleResolver ?? new AtprotoHandleResolverNode(options),
    handleCache,
    onHandleCacheError,
  )
}
