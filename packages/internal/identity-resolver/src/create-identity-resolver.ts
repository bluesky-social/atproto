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
  if ('identityResolver' in options && options.identityResolver != null) {
    return options.identityResolver
  }

  if ('handleResolver' in options && options.handleResolver != null) {
    const didResolver = createDidResolver(options)
    const handleResolver = createHandleResolver(
      options as typeof options & {
        handleResolver: NonNullable<(typeof options)['handleResolver']>
      },
    )
    return new AtprotoIdentityResolver(didResolver, handleResolver)
  }

  throw new TypeError('identityResolver or handleResolver option is required')
}
