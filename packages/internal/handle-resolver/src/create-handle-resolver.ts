import { CachedHandleResolver, HandleCache } from './cached-handle-resolver.js'
import { HandleResolver } from './types.js'
import {
  XrpcHandleResolver,
  XrpcHandleResolverOptions,
} from './xrpc-handle-resolver.js'

export type CreateHandleResolverOptions = {
  handleCache?: HandleCache
  handleResolver?: URL | string | HandleResolver
} & Partial<XrpcHandleResolverOptions>

export function createHandleResolver(
  options: CreateHandleResolverOptions,
): HandleResolver {
  const { handleResolver, handleCache } = options

  if (handleResolver == null) {
    // Because the handle resolution mechanism requires either a DNS based
    // handle resolver or an XRPC based handle resolver, we require the
    // handleResolver option to be provided.
    throw new TypeError('handleResolver is required')
  }

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
