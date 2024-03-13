import { safeFetchWrap } from '@atproto/fetch-node'
import {
  AccessTokenType,
  Branding,
  Keyset,
  OAuthProvider,
} from '@atproto/oauth-provider'
import { AccountManager } from './account-manager'
import { fetchLogger, oauthLogger } from './logger'
import { OauthClientStore } from './oauth/oauth-client-store'
import { Redis } from 'ioredis'
import { OAuthReplayStoreRedis } from '@atproto/oauth-provider-replay-redis'
import { OAuthReplayStoreMemory } from '@atproto/oauth-provider-replay-memory'

export class AuthProvider extends OAuthProvider {
  constructor(
    accountManager: AccountManager,
    keyset: Keyset,
    redis: Redis | undefined,
    dpopSecret: false | string | Uint8Array,
    issuer: string,
    private branding?: Branding,
    disableSsrf = false,
  ) {
    super({
      issuer,
      keyset,
      dpopSecret,

      accountStore: accountManager,
      requestStore: accountManager,
      sessionStore: accountManager,
      tokenStore: accountManager,
      replayStore: redis
        ? new OAuthReplayStoreRedis(redis)
        : new OAuthReplayStoreMemory(),
      clientStore: new OauthClientStore({
        // A Fetch function that protects against SSRF attacks, large responses &
        // known bad domains. This function can safely be used to fetch user
        // provided URLs.
        fetch: safeFetchWrap({
          allowHttp: disableSsrf,
          responseMaxSize: 512 * 1024, // 512kB
          ssrfProtection: !disableSsrf,
          fetch: async (request) => {
            fetchLogger.info(
              { method: request.method, uri: request.url },
              'fetch',
            )
            return globalThis.fetch(request)
          },
        }),
      }),

      // If the PDS is both an authorization server & resource server (no
      // entryway), there is no need to use JWTs as access tokens. Instead,
      // the PDS can use tokenId as access tokens. This allows the PDS to
      // always use up-to-date token data from the token store.
      accessTokenType: AccessTokenType.id,

      onAuthorizationRequest: (parameters, { client, clientAuth }) => {
        // ATPROTO extension: if the client is not "trustable", force the
        // user to consent to the request. We do this to avoid
        // unauthenticated clients from being able to silently
        // re-authenticate users.

        // TODO: make allow listed client ids configurable
        if (clientAuth.method === 'none' && client.id !== 'https://bsky.app/') {
          // Prevent sso and require consent by default
          if (!parameters.prompt || parameters.prompt === 'none') {
            parameters.prompt = 'consent'
          }
        }
      },

      onTokenResponse: (tokenResponse, { account }) => {
        // ATPROTO extension: add the sub claim to the token response to allow
        // clients to resolve the PDS url (audience) using the did resolution
        // mechanism.
        tokenResponse['sub'] = account.sub
      },
    })
  }

  createRouter() {
    return this.httpHandler({
      branding: this.branding,

      // Log oauth provider errors using our own logger
      onError: (req, res, err) => {
        oauthLogger.error({ err }, 'oauth-provider error')
      },
    })
  }
}
