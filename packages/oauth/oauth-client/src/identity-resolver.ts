export {
  type CreateIdentityResolverOptions,
  createIdentityResolver,
} from '@atproto-labs/identity-resolver'

// @TODO Currently, the `OAuthClient`'s `IdentityResolver` is an instance of
// `AtprotoIdentityResolver`, which implements the ATProto Identity resolution
// protocol (did resolution + dns resolution). In the future, we may want to
// allow using a different `IdentityResolver` implementation, such as one based
// on XRPC's "com.atproto.identity.resolveIdentity" method. This would be
// particularly useful for browser based clients, since DNS lookups are not
// available in browser environments (and require an alternative implementation,
// such as one based on the "com.atproto.identity.resolveHandle" XRPC method, or
// using DNS-over-HTTPS). Once we decide to support such a behavior, the
// `identityResolver` option below should be made mandatory, and the code bellow
// should be removed from the @atproto/oauth-client package (and moved to the
// environment specific package, such as @atproto/oauth-client-browser and
// @atproto/oauth-client-node), allowing the dependency graph to be optimized
// for the specific environment. When that is done, the
// `AtprotoIdentityResolver` class should also be moved to its own package.

// @TODO Once we move to a distinct implementation, we should also introduce a
// caching layer for the `IdentityResolver` to avoid redundant resolution
// requests. Once this is done, the caching layers for the did and handle
// resolvers should be removed as they will be redundant.
