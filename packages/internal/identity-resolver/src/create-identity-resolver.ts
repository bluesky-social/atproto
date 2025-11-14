import {
  CreateDidResolverOptions,
  createDidResolver,
} from '@atproto-labs/did-resolver'
import {
  CreateHandleResolverOptions,
  createHandleResolver,
} from '@atproto-labs/handle-resolver'
import { AtprotoIdentityResolver } from './atproto-identity-resolver.js'
import { IdentityResolver } from './identity-resolver.js'

export type CreateIdentityResolverOptions = {
  identityResolver?: IdentityResolver
} & Partial<CreateDidResolverOptions & CreateHandleResolverOptions>

export function createIdentityResolver(
  options: CreateIdentityResolverOptions,
): IdentityResolver {
  const { identityResolver } = options
  if (identityResolver != null) return identityResolver

  const didResolver = createDidResolver(options)
  const handleResolver = createHandleResolver(options)
  return new AtprotoIdentityResolver(didResolver, handleResolver)
}
