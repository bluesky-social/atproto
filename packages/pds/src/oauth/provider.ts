import {
  AccessTokenType,
  OAuthProvider,
  OAuthProviderOptions,
} from '@atproto/oauth-provider'

import { AccountManager } from '../account-manager/index'
import { ActorStore } from '../actor-store/index'
import { oauthLogger } from '../logger'
import { LocalViewerCreator } from '../read-after-write/index'
import { DetailedAccountStore } from './detailed-account-store'

export type AuthProviderOptions = {
  accountManager: AccountManager
  actorStore: ActorStore
  localViewer: LocalViewerCreator
} & Pick<
  OAuthProviderOptions,
  'issuer' | 'redis' | 'keyset' | 'dpopSecret' | 'customization'
> &
  Required<Pick<OAuthProviderOptions, 'safeFetch'>>

export class PdsOAuthProvider extends OAuthProvider {
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
      customization,
      metadata: {
        // PdsOAuthProvider is used when the PDS is both an authorization server
        // & resource server, in which case the issuer origin is also the
        // resource server uri.
        protected_resources: [new URL(issuer).origin],
      },

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

      onClientInfo: (clientId) => ({
        isFirstParty: clientId === 'https://bsky.app/',
        // @TODO make client client list configurable:
        isTrusted: undefined,
      }),
    })
  }

  createRouter() {
    return this.httpHandler({
      onError: (req, res, err, message) => oauthLogger.error({ err }, message),
    })
  }
}
