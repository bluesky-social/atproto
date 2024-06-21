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

export type { OAuthClientOptions, OAuthResponseMode, RuntimeLock }

export type NodeOAuthClientOptions = Omit<
  OAuthClientOptions,
  'responseMode' | 'runtimeImplementation' | 'handleResolver'
> & {
  fallbackNameservers?: AtprotoHandleResolverNodeOptions['fallbackNameservers']
  responseMode?: OAuthResponseMode
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

    requestLock = undefined,

    ...options
  }: NodeOAuthClientOptions) {
    if (!requestLock) {
      // Ok if only one instance of the client is running at a time.
      console.warn('No lock mechanism provided. Credentials might get revoked.')
    }

    super({
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
      ...options,
    })
  }
}
