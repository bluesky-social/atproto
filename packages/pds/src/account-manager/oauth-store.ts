import { Client, createOp as createPlcOp } from '@did-plc/lib'
import { Selectable } from 'kysely'
import { Keypair, Secp256k1Keypair } from '@atproto/crypto'
import {
  Account,
  AccountInfo,
  AccountStore,
  AuthenticateAccountData,
  Code,
  DeviceAccountInfo,
  DeviceData,
  DeviceId,
  DeviceStore,
  FoundRequestResult,
  HandleUnavailableError,
  InvalidInviteCodeError,
  InvalidRequestError,
  NewTokenData,
  RefreshToken,
  RequestData,
  RequestId,
  RequestStore,
  ResetPasswordConfirmData,
  ResetPasswordRequestData,
  SignUpData,
  TokenData,
  TokenId,
  TokenInfo,
  TokenStore,
  UpdateRequestData,
} from '@atproto/oauth-provider'
import {
  AuthRequiredError as XrpcAuthRequiredError,
  InvalidRequestError as XrpcInvalidRequestError,
} from '@atproto/xrpc-server'
import { ActorStore } from '../actor-store/actor-store'
import { BackgroundQueue } from '../background'
import { ImageUrlBuilder } from '../image/image-url-builder'
import { ServerMailer } from '../mailer'
import { Sequencer, syncEvtDataFromCommit } from '../sequencer'
import { AccountManager } from './account-manager'
import { AccountStatus, ActorAccount } from './helpers/account'
import * as authRequest from './helpers/authorization-request'
import * as device from './helpers/device'
import * as deviceAccount from './helpers/device-account'
import * as token from './helpers/token'
import * as usedRefreshToken from './helpers/used-refresh-token'

/**
 * This class' purpose is to implement the interface needed by the OAuthProvider
 * to interact with the account database (through the {@link AccountManager}).
 *
 * @note The use of this class assumes that there is no entryway.
 */
export class OAuthStore
  implements AccountStore, RequestStore, DeviceStore, TokenStore
{
  constructor(
    private readonly accountManager: AccountManager,
    private readonly actorStore: ActorStore,
    private readonly imageUrlBuilder: ImageUrlBuilder,
    private readonly backgroundQueue: BackgroundQueue,
    private readonly mailer: ServerMailer,
    private readonly sequencer: Sequencer,
    private readonly plcClient: Client,
    private readonly plcRotationKey: Keypair,
    private readonly publicUrl: string,
    private readonly recoveryDidKey: string | null,
  ) {}

  private get db() {
    const { db } = this.accountManager
    if (db.destroyed) throw new Error('Database connection is closed')
    return db
  }

  private get serviceDid() {
    return this.accountManager.serviceDid
  }

  private async buildAccount(row: Selectable<ActorAccount>): Promise<Account> {
    const account = deviceAccount.toAccount(row, this.serviceDid)

    if (!account.name || !account.picture) {
      const did = account.sub

      const profile = await this.actorStore.read(did, async (store) => {
        return store.record.getProfileRecord()
      })

      if (profile) {
        const { avatar, displayName } = profile

        account.name ||= displayName
        account.picture ||= avatar
          ? this.imageUrlBuilder.build('avatar', did, avatar.ref.toString())
          : undefined
      }
    }

    return account
  }

  private async verifyEmailAvailability(email: string): Promise<void> {
    // @NOTE Email validity & disposability check performed by the OAuthProvider

    const account = await this.accountManager.getAccountByEmail(email, {
      includeDeactivated: true,
      includeTakenDown: true,
    })

    if (account) {
      throw new InvalidRequestError(`Email already taken`)
    }
  }

  private async verifyInviteCode(code: string) {
    try {
      await this.accountManager.ensureInviteIsAvailable(code)
    } catch (err) {
      const message =
        err instanceof XrpcInvalidRequestError ? err.message : undefined
      throw new InvalidInviteCodeError(message, err)
    }
  }

  // AccountStore

  async createAccount({
    locale: _locale,
    inviteCode,
    handle,
    email,
    password,
  }: SignUpData): Promise<Account> {
    // @TODO Send an account creation confirmation email (+verification link) to the user (in their locale)
    // @NOTE Password strength already enforced by the OAuthProvider

    await Promise.all([
      this.verifyEmailAvailability(email),
      this.verifyHandleAvailability(handle),
      !inviteCode || this.verifyInviteCode(inviteCode),
    ])

    // @TODO The code bellow should probably be refactored to be common with the
    // code of the `com.atproto.server.createAccount` XRPC endpoint.

    const signingKey = await Secp256k1Keypair.create({ exportable: true })
    const signingKeyDid = signingKey.did()

    const plcCreate = await createPlcOp({
      signingKey: signingKeyDid,
      rotationKeys: this.recoveryDidKey
        ? [this.recoveryDidKey, this.plcRotationKey.did()]
        : [this.plcRotationKey.did()],
      handle,
      pds: this.publicUrl,
      signer: this.plcRotationKey,
    })

    const { did, op } = plcCreate

    try {
      await this.actorStore.create(did, signingKey)
      try {
        const commit = await this.actorStore.transact(did, (actorTxn) =>
          actorTxn.repo.createRepo([]),
        )

        await this.plcClient.sendOperation(did, op)

        await this.accountManager.createAccount({
          did,
          handle,
          email,
          password,
          inviteCode,
          repoCid: commit.cid,
          repoRev: commit.rev,
        })
        try {
          await this.sequencer.sequenceIdentityEvt(did, handle)
          await this.sequencer.sequenceAccountEvt(did, AccountStatus.Active)
          await this.sequencer.sequenceCommit(did, commit)
          await this.sequencer.sequenceSyncEvt(
            did,
            syncEvtDataFromCommit(commit),
          )
          await this.accountManager.updateRepoRoot(did, commit.cid, commit.rev)
          await this.actorStore.clearReservedKeypair(signingKeyDid, did)

          const account = await this.accountManager.getAccount(did)
          if (!account) throw new Error('Account not found')

          return await this.buildAccount(account)
        } catch (err) {
          this.accountManager.deleteAccount(did)
          throw err
        }
      } catch (err) {
        await this.actorStore.destroy(did)
        throw err
      }
    } catch (err) {
      // XrpcError => OAuthError
      if (err instanceof XrpcInvalidRequestError) {
        throw new InvalidRequestError(err.message, err)
      }
      throw err
    }
  }

  async authenticateAccount({
    locale: _locale,
    username: identifier,
    password,
    // Not supported by the PDS (yet?)
    emailOtp = undefined,
  }: AuthenticateAccountData): Promise<Account> {
    // @TODO (?) Send an email to the user to notify them of the login attempt
    try {
      // Should never happen
      if (emailOtp != null) {
        throw new Error('Email OTP is not supported')
      }

      const { user, appPassword, isSoftDeleted } =
        await this.accountManager.login({ identifier, password })

      if (isSoftDeleted) {
        throw new InvalidRequestError('Account was taken down')
      }

      if (appPassword) {
        throw new InvalidRequestError('App passwords are not allowed')
      }

      return this.buildAccount(user)
    } catch (err) {
      if (err instanceof XrpcAuthRequiredError) {
        throw new InvalidRequestError(err.message, err)
      }
      throw err
    }
  }

  async addDeviceAccount(
    deviceId: DeviceId,
    sub: string,
    remember: boolean,
  ): Promise<DeviceAccountInfo> {
    const [row] = await this.db.executeWithRetry(
      deviceAccount.createOrUpdateQB(this.db, deviceId, sub, remember),
    )
    if (!row) throw new Error('Failed to create device account')
    return deviceAccount.toDeviceAccountInfo(row)
  }

  async addAuthorizedClient(
    deviceId: DeviceId,
    sub: string,
    clientId: string,
  ): Promise<void> {
    await this.db.transaction(async (dbTxn) => {
      const row = await deviceAccount
        .readQB(dbTxn, deviceId, sub)
        .executeTakeFirstOrThrow()

      const { authorizedClients } = deviceAccount.toDeviceAccountInfo(row)
      if (!authorizedClients.includes(clientId)) {
        await deviceAccount
          .updateQB(dbTxn, deviceId, sub, {
            authorizedClients: [...authorizedClients, clientId],
          })
          .execute()
      }
    })
  }

  async getDeviceAccount(
    deviceId: DeviceId,
    sub: string,
  ): Promise<AccountInfo | null> {
    const row = await deviceAccount
      .getAccountInfoQB(this.db, deviceId, sub)
      .executeTakeFirst()

    if (!row) return null

    return {
      account: await this.buildAccount(row),
      info: deviceAccount.toDeviceAccountInfo(row),
    }
  }

  async listDeviceAccounts(deviceId: DeviceId): Promise<AccountInfo[]> {
    const rows = await deviceAccount
      .listRememberedQB(this.db, deviceId)
      .execute()

    return Promise.all(
      rows.map(async (row) => ({
        account: await this.buildAccount(row),
        info: deviceAccount.toDeviceAccountInfo(row),
      })),
    )
  }

  async removeDeviceAccount(deviceId: DeviceId, sub: string): Promise<void> {
    await this.db.executeWithRetry(
      deviceAccount.removeQB(this.db, deviceId, sub),
    )
  }

  async resetPasswordRequest({
    locale: _locale,
    email,
  }: ResetPasswordRequestData): Promise<void> {
    const account = await this.accountManager.getAccountByEmail(email, {
      includeDeactivated: true,
      includeTakenDown: true,
    })

    if (!account?.email || !account?.handle) return

    const { handle } = account
    const token = await this.accountManager.createEmailToken(
      account.did,
      'reset_password',
    )

    // @TODO Use the locale to send the email in the right language
    await this.mailer.sendResetPassword(
      { handle, token },
      { to: account.email },
    )
  }

  async resetPasswordConfirm(data: ResetPasswordConfirmData): Promise<void> {
    try {
      await this.accountManager.resetPassword(data)
    } catch (err) {
      if (err instanceof XrpcInvalidRequestError) {
        throw new InvalidRequestError(err.message, err)
      }

      throw err
    }
  }

  async verifyHandleAvailability(handle: string): Promise<void> {
    // @NOTE Handle validity & normalization already enforced by the OAuthProvider
    try {
      const normalized =
        await this.accountManager.normalizeAndValidateHandle(handle)

      // Should never happen (OAuthProvider should have already validated the
      // handle) This check is just a safeguard against future normalization
      // changes.
      if (normalized !== handle) {
        throw new HandleUnavailableError('syntax', 'Invalid handle')
      }

      const account = await this.accountManager.getAccount(normalized, {
        includeDeactivated: true,
        includeTakenDown: true,
      })

      if (account) {
        throw new HandleUnavailableError('taken')
      }
    } catch (err) {
      if (err instanceof XrpcInvalidRequestError) {
        throw err.customErrorName === 'HandleNotAvailable'
          ? new HandleUnavailableError('taken', err.message)
          : new HandleUnavailableError('syntax', err.message)
      }

      throw err
    }
  }

  // RequestStore

  async createRequest(id: RequestId, data: RequestData): Promise<void> {
    await this.db.executeWithRetry(authRequest.createQB(this.db, id, data))
  }

  async readRequest(id: RequestId): Promise<RequestData | null> {
    try {
      const row = await authRequest.readQB(this.db, id).executeTakeFirst()
      if (!row) return null
      return authRequest.rowToRequestData(row)
    } finally {
      // Take the opportunity to clean up expired requests. Do this after we got
      // the current (potentially expired) request data to allow the provider to
      // handle expired requests.
      this.backgroundQueue.add(async () => {
        await this.db.executeWithRetry(authRequest.removeOldExpiredQB(this.db))
      })
    }
  }

  async updateRequest(id: RequestId, data: UpdateRequestData): Promise<void> {
    await this.db.executeWithRetry(authRequest.updateQB(this.db, id, data))
  }

  async deleteRequest(id: RequestId): Promise<void> {
    await this.db.executeWithRetry(authRequest.removeByIdQB(this.db, id))
  }

  async findRequestByCode(code: Code): Promise<FoundRequestResult | null> {
    const row = await authRequest.findByCodeQB(this.db, code).executeTakeFirst()
    return row ? authRequest.rowToFoundRequestResult(row) : null
  }

  // DeviceStore

  async createDevice(deviceId: DeviceId, data: DeviceData): Promise<void> {
    await this.db.executeWithRetry(device.createQB(this.db, deviceId, data))
  }

  async readDevice(deviceId: DeviceId): Promise<null | DeviceData> {
    const row = await device.readQB(this.db, deviceId).executeTakeFirst()
    return row ? device.rowToDeviceData(row) : null
  }

  async updateDevice(
    deviceId: DeviceId,
    data: Partial<DeviceData>,
  ): Promise<void> {
    await this.db.executeWithRetry(device.updateQB(this.db, deviceId, data))
  }

  async deleteDevice(deviceId: DeviceId): Promise<void> {
    // Will cascade to device_account (device_account_device_id_fk)
    await this.db.executeWithRetry(device.removeQB(this.db, deviceId))
  }

  // TokenStore

  async createToken(
    id: TokenId,
    data: TokenData,
    refreshToken?: RefreshToken,
  ): Promise<void> {
    await this.db.transaction(async (dbTxn) => {
      if (refreshToken) {
        const { count } = await usedRefreshToken
          .countQB(dbTxn, refreshToken)
          .executeTakeFirstOrThrow()

        if (count > 0) {
          throw new Error('Refresh token already in use')
        }
      }

      return token.createQB(dbTxn, id, data, refreshToken).execute()
    })
  }

  async readToken(tokenId: TokenId): Promise<TokenInfo | null> {
    const row = await token.findByQB(this.db, { tokenId }).executeTakeFirst()
    return row ? token.toTokenInfo(row, this.serviceDid) : null
  }

  async deleteToken(tokenId: TokenId): Promise<void> {
    // Will cascade to used_refresh_token (used_refresh_token_fk)
    await this.db.executeWithRetry(token.removeQB(this.db, tokenId))
  }

  async rotateToken(
    tokenId: TokenId,
    newTokenId: TokenId,
    newRefreshToken: RefreshToken,
    newData: NewTokenData,
  ): Promise<void> {
    const err = await this.db.transaction(async (dbTxn) => {
      const { id, currentRefreshToken } = await token
        .forRotateQB(dbTxn, tokenId)
        .executeTakeFirstOrThrow()

      if (currentRefreshToken) {
        await usedRefreshToken
          .insertQB(dbTxn, id, currentRefreshToken)
          .execute()
      }

      const { count } = await usedRefreshToken
        .countQB(dbTxn, newRefreshToken)
        .executeTakeFirstOrThrow()

      if (count > 0) {
        // Do NOT throw (we don't want the transaction to be rolled back)
        return new Error('New refresh token already in use')
      }

      await token
        .rotateQB(dbTxn, id, newTokenId, newRefreshToken, newData)
        .execute()
    })

    if (err) throw err
  }

  async findTokenByRefreshToken(
    refreshToken: RefreshToken,
  ): Promise<TokenInfo | null> {
    const used = await usedRefreshToken
      .findByTokenQB(this.db, refreshToken)
      .executeTakeFirst()

    const search = used
      ? { id: used.tokenId }
      : { currentRefreshToken: refreshToken }

    const row = await token.findByQB(this.db, search).executeTakeFirst()
    return row ? token.toTokenInfo(row, this.serviceDid) : null
  }

  async findTokenByCode(code: Code): Promise<TokenInfo | null> {
    const row = await token.findByQB(this.db, { code }).executeTakeFirst()
    return row ? token.toTokenInfo(row, this.serviceDid) : null
  }
}
