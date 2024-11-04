import {
  AccountInfo,
  AccountStore,
  DeviceId,
  SignInCredentials,
} from '@atproto/oauth-provider'

import { AccountManager } from '../account-manager/index'
import { ActorStore } from '../actor-store/index'
import { ProfileViewBasic } from '../lexicon/types/app/bsky/actor/defs'
import { LocalViewerCreator } from '../read-after-write/index'

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
  constructor(
    private accountManager: AccountManager,
    private actorStore: ActorStore,
    private localViewer: LocalViewerCreator,
  ) {}

  private async getProfile(did: string): Promise<ProfileViewBasic | null> {
    // TODO: Should we cache this?
    return this.actorStore.read(did, async (actorStoreReader) => {
      const localViewer = this.localViewer(actorStoreReader)
      return localViewer.getProfileBasic()
    })
  }

  private async enrichAccountInfo(
    accountInfo: AccountInfo,
  ): Promise<AccountInfo> {
    const { account } = accountInfo
    if (!account.picture || !account.name) {
      const profile = await this.getProfile(account.sub)
      if (profile) {
        account.picture ||= profile.avatar
        account.name ||= profile.displayName
      }
    }

    return accountInfo
  }

  async authenticateAccount(
    credentials: SignInCredentials,
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
