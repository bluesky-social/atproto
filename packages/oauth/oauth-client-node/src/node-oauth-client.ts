import { createHash, randomBytes } from 'node:crypto'
import { JoseKey } from '@atproto/jwk-jose'
import {
  type HandleResolver,
  OAuthClient,
  type OAuthClientFetchMetadataOptions,
  type OAuthClientOptions,
  type RuntimeImplementation,
  type RuntimeLock,
} from '@atproto/oauth-client'
import type { OAuthResponseMode } from '@atproto/oauth-types'
import {
  AtprotoHandleResolverNode,
  type AtprotoHandleResolverNodeOptions,
} from '@atproto-labs/handle-resolver-node'
import {
  type NodeSavedSessionStore,
  type NodeSavedStateStore,
  toDpopKeyStore,
} from './node-dpop-store.js'
import type { Override } from './util.js'

export type * from './node-dpop-store.js'
export type { OAuthClientOptions, OAuthResponseMode, RuntimeLock }

export type NodeOAuthClientOptions = Override<
  OAuthClientOptions,
  {
    responseMode?: Exclude<OAuthResponseMode, 'fragment'>

    stateStore: NodeSavedStateStore
    sessionStore: NodeSavedSessionStore

    /**
     * Used to build a {@link NodeOAuthClientOptions.handleResolver} if none is
     * provided.
     */
    fallbackNameservers?: AtprotoHandleResolverNodeOptions['fallbackNameservers']

    handleResolver?: HandleResolver | string | URL

    /**
     * Used to build a {@link NodeOAuthClientOptions.runtimeImplementation} if
     * none is provided. Pass in `requestLocalLock` from `@atproto/oauth-client`
     * to mute warning.
     */
    requestLock?: RuntimeLock

    runtimeImplementation?: RuntimeImplementation
  }
>

export type NodeOAuthClientFromMetadataOptions =
  OAuthClientFetchMetadataOptions &
    Omit<NodeOAuthClientOptions, 'clientMetadata'>

export class NodeOAuthClient extends OAuthClient {
  constructor({
    requestLock = undefined,
    fallbackNameservers = undefined,

    fetch,
    responseMode = 'query',

    stateStore,
    sessionStore,

    handleResolver = new AtprotoHandleResolverNode({
      fetch,
      fallbackNameservers,
    }),

    runtimeImplementation = {
      requestLock,
      createKey: (algs) => JoseKey.generate(algs),
      getRandomValues: randomBytes,
      digest: (bytes, algorithm) =>
        createHash(algorithm.name).update(bytes).digest(),
    },

    ...options
  }: NodeOAuthClientOptions) {
    if (!runtimeImplementation.requestLock) {
      // Ok if only one instance of the client is running at a time.
      console.warn('No lock mechanism provided. Credentials might get revoked.')
    }

    super({
      ...options,

      fetch,
      responseMode,
      handleResolver,
      runtimeImplementation,

      stateStore: toDpopKeyStore(stateStore),
      sessionStore: toDpopKeyStore(sessionStore),
    })
  }
}
