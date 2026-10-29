import {
  type CreateIdentityResolverOptions,
  createIdentityResolver,
} from '@atproto-labs/identity-resolver'
import type { StoreErrorHandler } from '@atproto-labs/simple-store'
import { SimpleStoreMemory } from '@atproto-labs/simple-store-memory'
import {
  type AuthorizationServerMetadataCache,
  OAuthAuthorizationServerMetadataResolver,
} from './oauth-authorization-server-metadata-resolver.js'
import {
  OAuthProtectedResourceMetadataResolver,
  type ProtectedResourceMetadataCache,
} from './oauth-protected-resource-metadata-resolver.js'
import { OAuthResolver } from './oauth-resolver.js'

export type CreateOAuthResolverOptions = CreateIdentityResolverOptions & {
  protectedResourceMetadataCache?: ProtectedResourceMetadataCache
  authorizationServerMetadataCache?: AuthorizationServerMetadataCache
  onCacheError?: StoreErrorHandler
}

export function createOAuthResolver({
  fetch = globalThis.fetch,
  allowHttp = false,
  protectedResourceMetadataCache = new SimpleStoreMemory({
    ttl: 60e3,
    max: 100,
  }),
  authorizationServerMetadataCache = new SimpleStoreMemory({
    ttl: 60e3,
    max: 100,
  }),
  onCacheError,
  ...options
}: CreateOAuthResolverOptions): OAuthResolver {
  const identityResolver = createIdentityResolver({
    ...options,
    allowHttp,
    fetch,
  })
  return new OAuthResolver(
    identityResolver,
    new OAuthProtectedResourceMetadataResolver(
      protectedResourceMetadataCache,
      fetch,
      { allowHttpResource: allowHttp, onCacheError },
    ),
    new OAuthAuthorizationServerMetadataResolver(
      authorizationServerMetadataCache,
      fetch,
      { allowHttpIssuer: allowHttp, onCacheError },
    ),
  )
}
