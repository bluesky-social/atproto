import {
  AccountInfo,
  AccountStore,
  DeviceId,
  LoginCredentials,
} from '@atproto/oauth-provider'
import { CachedGetter } from '@atproto/simple-store'
import { SimpleStoreMemory } from '@atproto/simple-store-memory'

import { AccountManager } from '../account-manager/index.js'
import { ActorStore } from '../actor-store/index.js'
import { ProfileViewBasic } from '../lexicon/types/app/bsky/actor/defs.js'
import { LocalViewerCreator } from '../read-after-write/index.js'

/**
 * Although the {@link AccountManager} class implements the {@link AccountStore}
 * interface, the accounts it returns do not contain any profile information
 * (display name, avatar, etc). This is due to the fact that the account manager
 * does not have access to the account's repos. The {@link DetailedAccountStore}
 * is a wrapper around the {@link AccountManager} that enriches the accounts
 * with profile information using the account's repos through the
 * {@link ActorStore}.
 */
export class DetailedAccountStore implements AccountStore {
  private basicProfileGetter: BasicProfileGetterCached

  constructor(
    private accountManager: AccountManager,
    actorStore: ActorStore,
    localViewer: LocalViewerCreator,
  ) {
    this.basicProfileGetter = new BasicProfileGetterCached(
      actorStore,
      localViewer,
    )
  }

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
    const accountInfo = await this.accountManager.authenticateAccount(
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
    return this.accountManager.addAuthorizedClient(deviceId, sub, clientId)
  }

  async getDeviceAccount(
    deviceId: DeviceId,
    sub: string,
  ): Promise<AccountInfo | null> {
    const accountInfo = await this.accountManager.getDeviceAccount(
      deviceId,
      sub,
    )
    if (!accountInfo) return null
    return this.enrichAccountInfo(accountInfo)
  }

  async listDeviceAccounts(deviceId: DeviceId): Promise<AccountInfo[]> {
    const accountInfos = await this.accountManager.listDeviceAccounts(deviceId)
    return Promise.all(
      accountInfos.map(async (accountInfo) =>
        this.enrichAccountInfo(accountInfo),
      ),
    )
  }

  async removeDeviceAccount(deviceId: DeviceId, sub: string): Promise<void> {
    return this.accountManager.removeDeviceAccount(deviceId, sub)
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
 * get method (in memory).
 */
class BasicProfileGetterCached
  extends BasicProfileGetter
  implements BasicProfileGetter
{
  readonly #getter = new CachedGetter<string, ProfileViewBasic | null>(
    (did) => super.get(did),
    new SimpleStoreMemory({
      max: 1000,
      ttl: 10 * 60e3,
    }),
  )

  async get(did: string): Promise<ProfileViewBasic | null> {
    return this.#getter.get(did)
  }
}
