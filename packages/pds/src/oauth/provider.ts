import { Fetch } from '@atproto/fetch'
import {
  AccessTokenType,
  Customization,
  DpopManagerOptions,
  Keyset,
  OAuthProvider,
} from '@atproto/oauth-provider'
import { Redis, RedisOptions } from 'ioredis'

import { AccountManager } from '../account-manager/index.js'
import { ActorStore } from '../actor-store/index.js'
import { oauthLogger } from '../logger.js'
import { LocalViewerCreator } from '../read-after-write/index.js'
import { DetailedAccountStore } from './detailed-account-store.js'

export type AuthProviderOptions = {
  issuer: string
  keyset: Keyset
  accountManager: AccountManager
  actorStore: ActorStore
  localViewer: LocalViewerCreator
  redis?: Redis | RedisOptions | string
  dpopSecret?: DpopManagerOptions['dpopSecret']
  customization?: Customization
  safeFetch: Fetch
}

export class PdsOAuthProvider extends OAuthProvider {
  private customization?: Customization

  constructor({
    accountManager,
    actorStore,
    localViewer,
    keyset,
    redis,
    dpopSecret,
    issuer,
    customization,
    safeFetch,
  }: AuthProviderOptions) {
    super({
      issuer,
      keyset,
      dpopSecret,
      redis,
      safeFetch,

      accountStore: new DetailedAccountStore(
        accountManager,
        actorStore,
        localViewer,
      ),
      requestStore: accountManager,
      deviceStore: accountManager,
      tokenStore: accountManager,

      // If the PDS is both an authorization server & resource server (no
      // entryway), there is no need to use JWTs as access tokens. Instead,
      // the PDS can use tokenId as access tokens. This allows the PDS to
      // always use up-to-date token data from the token store.
      accessTokenType: AccessTokenType.id,

      // TODO: make client client list configurable
      onIsFirstPartyClient: (client) => client.id === 'https://bsky.app/',
    })

    this.customization = customization
  }

  createRouter() {
    return this.httpHandler({
      customization: this.customization,

      // Log oauth provider errors using our own logger
      onError: (req, res, err) => {
        oauthLogger.error({ err }, 'oauth-provider error')
      },
    })
  }
}
