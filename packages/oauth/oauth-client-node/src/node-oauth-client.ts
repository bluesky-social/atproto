import { createHash, randomBytes } from 'node:crypto'

import {
  AtprotoHandleResolverNode,
  AtprotoHandleResolverNodeOptions,
} from '@atproto-labs/handle-resolver-node'
import { JoseKey } from '@atproto/jwk-jose'
import {
  OAuthClient,
  OAuthClientFetchMetadataOptions,
  OAuthClientOptions,
  RuntimeLock,
} from '@atproto/oauth-client'
import { OAuthResponseMode } from '@atproto/oauth-types'

import {
  NodeSavedSessionStore,
  NodeSavedStateStore,
  toDpopKeyStore,
} from './node-dpop-store.js'

export type * from './node-dpop-store.js'
export type { OAuthClientOptions, OAuthResponseMode, RuntimeLock }

export type NodeOAuthClientOptions = Omit<
  OAuthClientOptions,
  // Overridden by this lib
  | 'responseMode'
  | 'stateStore'
  | 'sessionStore'
  // Provided by this lib
  | 'runtimeImplementation' // only "requestLock" needed
  | 'handleResolver' // Will be build based on "fallbackNameservers"
> & {
  responseMode?: Exclude<OAuthResponseMode, 'fragment'>

  stateStore: NodeSavedStateStore
  sessionStore: NodeSavedSessionStore

  fallbackNameservers?: AtprotoHandleResolverNodeOptions['fallbackNameservers']
  requestLock?: RuntimeLock
}

export type NodeOAuthClientFromMetadataOptions =
  OAuthClientFetchMetadataOptions &
    Omit<NodeOAuthClientOptions, 'clientMetadata'>

export class NodeOAuthClient extends OAuthClient {
  static async fromClientId(options: NodeOAuthClientFromMetadataOptions) {
    const clientMetadata = await OAuthClient.fetchMetadata(options)
    return new NodeOAuthClient({ ...options, clientMetadata })
  }

  constructor({
    fetch,
    responseMode = 'query',
    fallbackNameservers,

    stateStore,
    sessionStore,
    requestLock = undefined,

    ...options
  }: NodeOAuthClientOptions) {
    if (!requestLock) {
      // Ok if only one instance of the client is running at a time.
      console.warn('No lock mechanism provided. Credentials might get revoked.')
    }

    super({
      ...options,

      fetch,
      responseMode,
      handleResolver: new AtprotoHandleResolverNode({
        fetch,
        fallbackNameservers,
      }),
      runtimeImplementation: {
        requestLock,
        createKey: (algs) => JoseKey.generate(algs),
        getRandomValues: randomBytes,
        digest: (bytes, algorithm) =>
          createHash(algorithm.name).update(bytes).digest(),
      },

      stateStore: toDpopKeyStore(stateStore),
      sessionStore: toDpopKeyStore(sessionStore),
    })
  }
}
