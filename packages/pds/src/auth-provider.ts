import { LRUCache } from 'lru-cache'
import { safeFetchWrap } from '@atproto/fetch-node'
import {
  AccessTokenType,
  Account,
  AccountInfo,
  AccountStore,
  Branding,
  DeviceId,
  Keyset,
  LoginCredentials,
  OAuthProvider,
} from '@atproto/oauth-provider'
import { OAuthReplayStoreMemory } from '@atproto/oauth-provider-replay-memory'
import { OAuthReplayStoreRedis } from '@atproto/oauth-provider-replay-redis'

import { Redis } from 'ioredis'
import { AccountManager } from './account-manager'
import { fetchLogger, oauthLogger } from './logger'
import { OauthClientStore } from './oauth/oauth-client-store'
import { ActorStore } from './actor-store'
import { LocalViewerCreator } from './read-after-write'
import { ProfileViewBasic } from './lexicon/types/app/bsky/actor/defs'

export class AuthProvider extends OAuthProvider {
  constructor(
    accountManager: AccountManager,
    actorStore: ActorStore,
    localViewerCreator: LocalViewerCreator,
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

      // Even though the accountManager implements the AccountStore interface,
      // the accounts it returns do not contain any profile information (display
      // name, avatar, etc). This is due to the fact that the account manager
      // does not have access to the account's repos. The DetailedAccountStore
      // is a wrapper around the accountManager that enriches the accounts with
      // profile information using the account's repos through the actorStore.
      accountStore: new DetailedAccountStore(
        accountManager,
        new ActorProfileStoreCached(actorStore, localViewerCreator),
      ),
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

/**
 * This class wraps an AccountStore in order to enrich the accounts it returns
 * with profile information through the ActorStore.
 */
class DetailedAccountStore implements AccountStore {
  constructor(
    private store: AccountStore,
    private actorProfileStore: ActorProfileStore,
  ) {}

  private async enrichAccountInfo(
    accountInfo: AccountInfo,
  ): Promise<AccountInfo> {
    const { account } = accountInfo
    if (!account.picture || !account.name) {
      const profile = await this.actorProfileStore.get(account.sub)
      if (profile) {
        account.picture ||= profile.avatar
        account.name ||= profile.displayName
      }
    }

    return accountInfo
  }

  async authenticateAccount(
    credentials: LoginCredentials,
    deviceId: DeviceId,
  ): Promise<AccountInfo | null> {
    const accountInfo = await this.store.authenticateAccount(
      credentials,
      deviceId,
    )
    if (!accountInfo) return null
    return this.enrichAccountInfo(accountInfo)
  }

  async addAuthorizedClient(
    deviceId: DeviceId,
    sub: string,
    clientId: string,
  ): Promise<void> {
    return this.store.addAuthorizedClient(deviceId, sub, clientId)
  }

  async getDeviceAccount(
    deviceId: DeviceId,
    sub: string,
  ): Promise<AccountInfo | null> {
    const accountInfo = await this.store.getDeviceAccount(deviceId, sub)
    if (!accountInfo) return null
    return this.enrichAccountInfo(accountInfo)
  }

  async listDeviceAccounts(deviceId: DeviceId): Promise<AccountInfo[]> {
    const accountInfos = await this.store.listDeviceAccounts(deviceId)
    return Promise.all(
      accountInfos.map(async (accountInfo) =>
        this.enrichAccountInfo(accountInfo),
      ),
    )
  }

  async removeDeviceAccount(deviceId: DeviceId, sub: string): Promise<void> {
    return this.store.removeDeviceAccount(deviceId, sub)
  }
}

/**
 * Utility class to fetch profile information for a given DID.
 */
class ActorProfileStore {
  constructor(
    private actorStore: ActorStore,
    private localViewerCreator: LocalViewerCreator,
  ) {}

  public async get(did: string): Promise<ProfileViewBasic | null> {
    return this.actorStore.read(did, async (store) => {
      const localViewer = this.localViewerCreator(store)
      return localViewer.getProfileBasic()
    })
  }
}

/**
 * Drop-in replacement for ActorProfileStore that caches the results of the
 * get method.
 */
class ActorProfileStoreCached
  extends ActorProfileStore
  implements ActorProfileStore
{
  cache = new LRUCache<string, ProfileViewBasic | 'nullValue'>({
    ttl: 10 * 60e3, // 10 minutes
    max: 1000,
    allowStale: true,
    updateAgeOnGet: false,
    updateAgeOnHas: false,
    allowStaleOnFetchAbort: true,
    allowStaleOnFetchRejection: true,
    ignoreFetchAbort: true,
    noDeleteOnStaleGet: true,
    noDeleteOnFetchRejection: true,
    fetchMethod: async (did) => (await super.get(did)) ?? 'nullValue',
  })

  public async get(did: string): Promise<ProfileViewBasic | null> {
    const cached = await this.cache.fetch(did)
    if (cached != null) return cached === 'nullValue' ? null : cached

    // Should never happen when using the fetchMethod option
    const result = await super.get(did)
    this.cache.set(did, result ?? 'nullValue')
    return result
  }
}
