import {
  AccessTokenType,
  OAuthProvider,
  OAuthProviderOptions,
} from '@atproto/oauth-provider'
import { AccountManager } from '../account-manager/index'
import { oauthLogger } from '../logger'

export type AuthProviderOptions = {
  accountManager: AccountManager
} & Pick<
  OAuthProviderOptions,
  'issuer' | 'redis' | 'keyset' | 'dpopSecret' | 'customization' | 'trustProxy'
> &
  Required<Pick<OAuthProviderOptions, 'safeFetch'>>

export class PdsOAuthProvider extends OAuthProvider {
  constructor({
    accountManager,
    keyset,
    redis,
    dpopSecret,
    issuer,
    customization,
    safeFetch,
    trustProxy,
  }: AuthProviderOptions) {
    super({
      issuer,
      keyset,
      dpopSecret,
      redis,
      safeFetch,
      customization,
      store: accountManager,
      trustProxy,
      metadata: {
        // PdsOAuthProvider is used when the PDS is both an authorization server
        // & resource server, in which case the issuer origin is also the
        // resource server uri.
        protected_resources: [new URL(issuer).origin],

        scopes_supported: ['transition:generic', 'transition:chat.bsky'],
      },

      // If the PDS is both an authorization server & resource server (no
      // entryway), there is no need to use JWTs as access tokens. Instead,
      // the PDS can use tokenId as access tokens. This allows the PDS to
      // always use up-to-date token data from the token store.
      accessTokenType: AccessTokenType.id,
    })
  }

  createRouter() {
    return this.httpHandler({
      onError: (req, res, err, message) => oauthLogger.error({ err }, message),
    })
  }
}
