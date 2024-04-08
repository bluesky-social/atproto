import { safeFetchWrap } from '@atproto/fetch-node'
import {
  AccessTokenType,
  AccountInfo,
  AccountStore,
  Customization,
  DeviceId,
  DpopManagerOptions,
  Keyset,
  LoginCredentials,
  OAuthProvider,
} from '@atproto/oauth-provider'
import { OAuthReplayStoreMemory } from '@atproto/oauth-provider-replay-memory'
import { OAuthReplayStoreRedis } from '@atproto/oauth-provider-replay-redis'
import { Redis } from 'ioredis'

import { CachedGetter } from '@atproto/caching'
import { AccountManager } from './account-manager'
import { ActorStore } from './actor-store'
import { ProfileViewBasic } from './lexicon/types/app/bsky/actor/defs'
import { fetchLogger, oauthLogger } from './logger'
import { OauthClientStore } from './oauth/oauth-client-store'
import { LocalViewerCreator } from './read-after-write'

export type AuthProviderOptions = {
  issuer: string
  keyset: Keyset
  accountManager: AccountManager
  actorStore: ActorStore
  localViewer: LocalViewerCreator
  redis?: Redis
  dpopSecret?: DpopManagerOptions['dpopSecret']
  customization?: Customization
  disableSsrf?: boolean
}

export class AuthProvider extends OAuthProvider {
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
    disableSsrf = false,
  }: AuthProviderOptions) {
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
        new BasicProfileGetterCached(actorStore, localViewer),
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

/**
 * This class wraps an AccountStore in order to enrich the accounts it returns
 * with basic profile data from an ActorStore.
 */
class DetailedAccountStore implements AccountStore {
  constructor(
    private store: AccountStore,
    private basicProfileGetter: BasicProfileGetter,
  ) {}

  private async enrichAccountInfo(
    accountInfo: AccountInfo,
  ): Promise<AccountInfo> {
    const { account } = accountInfo
    if (!account.picture || !account.name) {
      const profile = await this.basicProfileGetter.get(account.sub)
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
 * Utility class to fetch basic profile data for a given DID.
 */
class BasicProfileGetter {
  constructor(
    private actorStore: ActorStore,
    private localViewer: LocalViewerCreator,
  ) {}

  public async get(did: string): Promise<ProfileViewBasic | null> {
    return this.actorStore.read(did, async (actorStoreReader) => {
      const localViewer = this.localViewer(actorStoreReader)
      return localViewer.getProfileBasic()
    })
  }
}

/**
 * Drop-in replacement for BasicProfileGetter that caches the results of the
 * get method.
 */
class BasicProfileGetterCached
  extends BasicProfileGetter
  implements BasicProfileGetter
{
  readonly #getter = new CachedGetter<string, ProfileViewBasic | null>((did) =>
    super.get(did),
  )

  async get(did: string): Promise<ProfileViewBasic | null> {
    return this.#getter.get(did)
  }
}
