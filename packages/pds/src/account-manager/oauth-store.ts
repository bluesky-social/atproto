import assert from 'node:assert'
import { type Client, createOp as createPlcOp } from '@did-plc/lib'
import type { Selectable } from 'kysely'
import { type Keypair, Secp256k1Keypair } from '@atproto/crypto'
import {
  type DidString,
  type HandleString,
  getBlobCidString,
} from '@atproto/lex'
import {
  HandleUnavailableError,
  InvalidCredentialsError,
  InvalidRequestError,
} from '@atproto/oauth-provider/errors'
import type {
  Account,
  AccountStore,
  AuthenticateAccountData,
  AuthorizedClientData,
  AuthorizedClients,
  ClientId,
  Code,
  DeactivateAccountData,
  DeleteAccountConfirmInput,
  DeleteAccountRequestInput,
  DeviceAccount,
  DeviceData,
  DeviceId,
  DeviceStore,
  Did,
  FoundRequestResult,
  HandleUnavailableReason,
  LexiconData,
  LexiconStore,
  NewTokenData,
  ReactivateAccountData,
  RefreshToken,
  RequestData,
  RequestId,
  RequestStore,
  ResetPasswordConfirmInput,
  ResetPasswordRequestInput,
  SignUpData,
  TokenData,
  TokenId,
  TokenInfo,
  TokenStore,
  UpdateEmailConfirmInput,
  UpdateEmailRequestInput,
  UpdateEmailRequestOutput,
  UpdateHandleData,
  UpdateRequestData,
  VerifyEmailConfirmInput,
  VerifyEmailRequestInput,
} from '@atproto/oauth-provider/store'
import {
  AuthRequiredError as XrpcAuthRequiredError,
  InvalidRequestError as XrpcInvalidRequestError,
} from '@atproto/xrpc-server'
import type { ActorStore } from '../actor-store/actor-store.js'
import type { BackgroundQueue } from '../background.js'
import { fromDateISO } from '../db/index.js'
import type { ImageUrlBuilder } from '../image/image-url-builder.js'
import { dbLogger } from '../logger.js'
import type { ServerMailer } from '../mailer/index.js'
import type { Sequencer } from '../sequencer/index.js'
import { type AccountManager, InvalidPasswordError } from './account-manager.js'
import type * as schemas from './db/schema/index.js'
import * as accountDeviceHelper from './helpers/account-device.js'
import { type ActorAccount, UserAlreadyExistsError } from './helpers/account.js'
import * as authRequestHelper from './helpers/authorization-request.js'
import * as authorizedClientHelper from './helpers/authorized-client.js'
import * as deviceHelper from './helpers/device.js'
import * as lexiconHelper from './helpers/lexicon.js'
import * as tokenHelper from './helpers/token.js'
import * as usedRefreshTokenHelper from './helpers/used-refresh-token.js'

/**
 * This class' purpose is to implement the interface needed by the OAuthProvider
 * to interact with the account database (through the {@link AccountManager}).
 *
 * @note The use of this class assumes that there is no entryway.
 */
export class OAuthStore
  implements AccountStore, RequestStore, DeviceStore, LexiconStore, TokenStore
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
      throw new InvalidRequestError(
        'This invite code is invalid.' + (message ? ` ${message}` : ''),
        err,
      )
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
    // @NOTE Password strength & length already enforced by the OAuthProvider

    await Promise.all([
      this.verifyEmailAvailability(email),
      this.verifyHandleAvailability(handle),
      !inviteCode || this.verifyInviteCode(inviteCode),
    ])

    // @TODO The code bellow should probably be refactored to be common with the
    // code of the `com.atproto.server.createAccount` XRPC endpoint.

    const signingKey = await Secp256k1Keypair.create({ exportable: true })
    const signingKeyDid = signingKey.did()

    const canTombstone =
      // @NOTE IMPORTANT We don't support "bring your own DID" here (yet?). If
      // we ever do, make sure to update the computation of canTombstone so that
      // the user's did don't get tombstoned.
      true

    const plc = await createPlcOp({
      signingKey: signingKeyDid,
      rotationKeys: this.recoveryDidKey
        ? [this.recoveryDidKey, this.plcRotationKey.did()]
        : [this.plcRotationKey.did()],
      handle,
      pds: this.publicUrl,
      signer: this.plcRotationKey,
    })

    const did = plc.did as DidString

    try {
      await this.actorStore.create(did, signingKey)

      try {
        const commit = await this.actorStore.transact(did, (actorTxn) => {
          return actorTxn.repo.createRepo([])
        })

        await this.plcClient.sendOperation(did, plc.op)

        try {
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
            await this.sequencer.sequenceAccountCreation(did, handle, commit)

            try {
              await this.actorStore
                .clearReservedKeypair(signingKeyDid, did)
                .catch((err) => {
                  // @NOTE This is a cleanup operation so we won't fail the
                  // whole flow if it fails, but we log it just in case
                  dbLogger.error(
                    { did, signingKeyDid, err },
                    'Failed to clear reserved keypair',
                  )
                })

              const account = await this.accountManager.getAccount(did)
              assert(account, 'Account not found after creation')

              return await this.buildAccount(account)
            } catch (err) {
              await this.sequencer.sequenceAccountDeletion(did)
              throw err
            }
          } catch (err) {
            await this.accountManager.deleteAccount(did)
            throw err
          }
        } catch (err) {
          if (canTombstone) {
            await this.plcClient.tombstone(did, this.plcRotationKey)
          }
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
      // `InvalidPasswordError` is a subclass of `XrpcAuthRequiredError`,
      // so it must be checked first. Surfacing the matched `did` as the
      // `sub` lets the oauth-provider's `onSignInFailed` hook distinguish
      // "identifier known, credentials wrong" from "identifier unknown".
      if (err instanceof InvalidPasswordError) {
        throw new InvalidCredentialsError(err.message, err.did, err)
      }
      if (err instanceof XrpcAuthRequiredError) {
        throw new InvalidCredentialsError(err.message, undefined, err)
      }
      throw err
    }
  }

  async setAuthorizedClient(
    did: Did,
    clientId: ClientId,
    data: AuthorizedClientData,
  ): Promise<void> {
    await authorizedClientHelper.upsert(this.db, did, clientId, data)
  }

  async getAccount(did: Did): Promise<{
    account: Account
    authorizedClients: AuthorizedClients
  }> {
    const accountRow = await this.accountManager.getAccount(did, {
      includeDeactivated: true,
      includeTakenDown: false,
    })

    assert(accountRow, 'Account not found')

    const account = await this.buildAccount(accountRow)
    const authorizedClients = await authorizedClientHelper.getAuthorizedClients(
      this.db,
      did,
    )

    return { account, authorizedClients }
  }

  async upsertDeviceAccount(deviceId: DeviceId, sub: string): Promise<void> {
    await this.db.executeWithRetry(
      accountDeviceHelper.upsertQB(this.db, deviceId, sub),
    )
  }

  async getDeviceAccount(
    deviceId: DeviceId,
    did: Did,
  ): Promise<DeviceAccount | null> {
    const row = await accountDeviceHelper
      .selectQB(this.db, { deviceId, did })
      .executeTakeFirst()

    if (!row) return null

    return {
      deviceId,
      deviceData: deviceHelper.rowToDeviceData(row),
      account: await this.buildAccount(row),
      authorizedClients: await authorizedClientHelper.getAuthorizedClients(
        this.db,
        did,
      ),
      createdAt: fromDateISO(row.adCreatedAt),
      updatedAt: fromDateISO(row.adUpdatedAt),
    }
  }

  async removeDeviceAccount(deviceId: DeviceId, did: Did): Promise<void> {
    await this.db.executeWithRetry(
      accountDeviceHelper.removeQB(this.db, deviceId, did),
    )
  }

  async listDeviceAccounts(
    filter: { did: Did } | { deviceId: DeviceId },
  ): Promise<DeviceAccount[]> {
    const rows = await accountDeviceHelper.selectQB(this.db, filter).execute()

    const uniqueDids = [...new Set(rows.map((row) => row.did))]

    // Enrich all distinct account with their profile data
    const accounts = new Map(
      await Promise.all(
        Array.from(uniqueDids, async (did): Promise<[Did, Account]> => {
          const row = rows.find((r) => r.did === did)!
          return [did, await this.buildAccount(row)]
        }),
      ),
    )

    const authorizedClientsMap =
      await authorizedClientHelper.getAuthorizedClientsMulti(
        this.db,
        uniqueDids,
      )

    return rows.map((row) => ({
      deviceId: row.deviceId,
      deviceData: deviceHelper.rowToDeviceData(row),
      account: accounts.get(row.did)!,
      authorizedClients: authorizedClientsMap.get(row.did)!,
      createdAt: fromDateISO(row.adCreatedAt),
      updatedAt: fromDateISO(row.adUpdatedAt),
    }))
  }

  async resetPasswordRequest({
    email,
    locale,
  }: ResetPasswordRequestInput): Promise<Account | null> {
    const account = await this.accountManager.getAccountByEmail(email, {
      includeDeactivated: true,
      includeTakenDown: false,
    })

    if (!account?.email || !account?.handle) return null

    const { handle } = account
    const token = await this.accountManager.createEmailToken(
      account.did,
      'reset_password',
    )

    await this.mailer.sendResetPassword(
      { handle, token, locale },
      { to: account.email },
    )

    return this.buildAccount(account)
  }

  async resetPasswordConfirm(
    data: ResetPasswordConfirmInput,
  ): Promise<Account | null> {
    try {
      const did = await this.accountManager.resetPassword(data)
      const account = await this.accountManager.getAccount(did, {
        includeDeactivated: true,
        includeTakenDown: false,
      })

      return account ? this.buildAccount(account) : null
    } catch (err) {
      if (err instanceof XrpcInvalidRequestError) {
        return null
      }

      throw err
    }
  }

  async verifyHandleAvailability(handle: HandleString): Promise<void> {
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
      throw toHandleUnavailableError(err)
    }
  }

  // RequestStore

  async createRequest(id: RequestId, data: RequestData): Promise<void> {
    await this.db.executeWithRetry(
      authRequestHelper.createQB(this.db, id, data),
    )
  }

  async readRequest(id: RequestId): Promise<RequestData | null> {
    try {
      const row = await authRequestHelper.readQB(this.db, id).executeTakeFirst()
      if (!row) return null
      return authRequestHelper.rowToRequestData(row)
    } finally {
      // Take the opportunity to clean up expired requests. Do this after we got
      // the current (potentially expired) request data to allow the provider to
      // handle expired requests.
      this.backgroundQueue.add(async () => {
        await this.db.executeWithRetry(
          authRequestHelper.removeOldExpiredQB(this.db),
        )
      })
    }
  }

  async updateRequest(id: RequestId, data: UpdateRequestData): Promise<void> {
    await this.db.executeWithRetry(
      authRequestHelper.updateQB(this.db, id, data),
    )
  }

  async deleteRequest(id: RequestId): Promise<void> {
    await this.db.executeWithRetry(authRequestHelper.removeByIdQB(this.db, id))
  }

  async consumeRequestCode(code: Code): Promise<FoundRequestResult | null> {
    const row = await authRequestHelper
      .consumeByCodeQB(this.db, code)
      .executeTakeFirst()
    return row ? authRequestHelper.rowToFoundRequestResult(row) : null
  }

  // DeviceStore

  async createDevice(deviceId: DeviceId, data: DeviceData): Promise<void> {
    await this.db.executeWithRetry(
      deviceHelper.createQB(this.db, deviceId, data),
    )
  }

  async readDevice(deviceId: DeviceId): Promise<null | DeviceData> {
    const row = await deviceHelper.readQB(this.db, deviceId).executeTakeFirst()
    return row ? deviceHelper.rowToDeviceData(row) : null
  }

  async updateDevice(
    deviceId: DeviceId,
    data: Partial<DeviceData>,
  ): Promise<void> {
    await this.db.executeWithRetry(
      deviceHelper.updateQB(this.db, deviceId, data),
    )
  }

  async deleteDevice(deviceId: DeviceId): Promise<void> {
    // Will cascade to device_account (device_account_device_id_fk)
    await this.db.executeWithRetry(deviceHelper.removeQB(this.db, deviceId))
  }

  // LexiconStore

  async findLexicon(nsid: string): Promise<LexiconData | null> {
    return lexiconHelper.find(this.db, nsid)
  }

  async storeLexicon(nsid: string, data: LexiconData): Promise<void> {
    return lexiconHelper.upsert(this.db, nsid, data)
  }

  async deleteLexicon(nsid: string): Promise<void> {
    return lexiconHelper.remove(this.db, nsid)
  }

  // TokenStore

  async createToken(
    id: TokenId,
    data: TokenData,
    refreshToken?: RefreshToken,
  ): Promise<void> {
    await this.db.transaction(async (dbTxn) => {
      if (refreshToken) {
        const { count } = await usedRefreshTokenHelper
          .countQB(dbTxn, refreshToken)
          .executeTakeFirstOrThrow()

        if (count > 0) {
          throw new Error('Refresh token already in use')
        }
      }

      return tokenHelper.createQB(dbTxn, id, data, refreshToken).execute()
    })
  }

  async listAccountTokens(did: Did): Promise<TokenInfo[]> {
    const rows = await tokenHelper.findByQB(this.db, { did }).execute()
    return Promise.all(rows.map((row) => this.toTokenInfo(row)))
  }

  async readToken(tokenId: TokenId): Promise<TokenInfo | null> {
    const row = await tokenHelper
      .findByQB(this.db, { tokenId })
      .executeTakeFirst()
    return row ? this.toTokenInfo(row) : null
  }

  async deleteToken(tokenId: TokenId): Promise<void> {
    // Will cascade to used_refresh_token (used_refresh_token_fk)
    await this.db.executeWithRetry(tokenHelper.removeQB(this.db, tokenId))
  }

  async rotateToken(
    tokenId: TokenId,
    newTokenId: TokenId,
    newRefreshToken: RefreshToken,
    newData: NewTokenData,
  ): Promise<void> {
    const err = await this.db.transaction(async (dbTxn) => {
      const { id, currentRefreshToken } = await tokenHelper
        .forRotateQB(dbTxn, tokenId)
        .executeTakeFirstOrThrow()

      if (currentRefreshToken) {
        await usedRefreshTokenHelper
          .insertQB(dbTxn, id, currentRefreshToken)
          .execute()
      }

      const { count } = await usedRefreshTokenHelper
        .countQB(dbTxn, newRefreshToken)
        .executeTakeFirstOrThrow()

      if (count > 0) {
        // Do NOT throw (we don't want the transaction to be rolled back)
        return new Error('New refresh token already in use')
      }

      await tokenHelper
        .rotateQB(dbTxn, id, newTokenId, newRefreshToken, newData)
        .execute()
    })

    if (err) throw err
  }

  async findTokenByRefreshToken(
    refreshToken: RefreshToken,
  ): Promise<TokenInfo | null> {
    const used = await usedRefreshTokenHelper
      .findByTokenQB(this.db, refreshToken)
      .executeTakeFirst()

    const search = used
      ? { id: used.tokenId }
      : { currentRefreshToken: refreshToken }

    const row = await tokenHelper.findByQB(this.db, search).executeTakeFirst()
    return row ? this.toTokenInfo(row) : null
  }

  async findTokenByCode(code: Code): Promise<TokenInfo | null> {
    const row = await tokenHelper.findByQB(this.db, { code }).executeTakeFirst()
    return row ? this.toTokenInfo(row) : null
  }

  async verifyEmailRequest({
    did,
    locale,
  }: VerifyEmailRequestInput): Promise<void> {
    try {
      await this.accountManager.requestEmailConfirmation(did, { locale })
    } catch (err) {
      if (err instanceof XrpcAuthRequiredError) {
        throw new InvalidRequestError(err.message, err)
      }

      throw err
    }
  }

  async verifyEmailConfirm({
    did,
    email,
    token,
  }: VerifyEmailConfirmInput): Promise<Account | null> {
    try {
      const account = await this.accountManager.confirmEmail(did, email, token)

      return this.buildAccount(account)
    } catch (err) {
      if (err instanceof XrpcInvalidRequestError) {
        return null
      }

      throw err
    }
  }

  async updateEmailRequest({
    did,
    locale,
  }: UpdateEmailRequestInput): Promise<UpdateEmailRequestOutput> {
    return this.accountManager.requestEmailUpdate(did, { locale })
  }

  async updateEmailConfirm({
    did,
    token,
    email,
    locale,
  }: UpdateEmailConfirmInput): Promise<Account | null> {
    try {
      const account = await this.accountManager.updateEmail(did, email, token, {
        sendConfirmationEmail: true,
        locale,
      })

      return this.buildAccount(account)
    } catch (cause) {
      if (cause instanceof UserAlreadyExistsError) {
        throw new InvalidRequestError(cause.message, cause)
      }

      throw cause
    }
  }

  async updateHandle({ did, handle }: UpdateHandleData): Promise<Account> {
    try {
      const account = await this.accountManager.updateHandle(did, handle)

      return this.buildAccount(account)
    } catch (err) {
      throw toHandleUnavailableError(err)
    }
  }

  async deactivateAccount({
    did,
    deleteAfter,
  }: DeactivateAccountData): Promise<Account> {
    const { account } = await this.accountManager.deactivateAccount(did, {
      deleteCredentials: true,
      deleteAfter,
    })

    return this.buildAccount(account)
  }

  async reactivateAccount({ did }: ReactivateAccountData): Promise<Account> {
    try {
      const { account } = await this.accountManager.activateAccount(did)

      return this.buildAccount(account)
    } catch (err) {
      if (err instanceof XrpcInvalidRequestError) {
        throw new InvalidRequestError(err.message, err)
      }

      throw err
    }
  }

  async deleteAccountRequest({
    did,
    locale,
  }: DeleteAccountRequestInput): Promise<void> {
    // Mirror the XRPC `com.atproto.server.requestAccountDelete` flow
    // (no-entryway path): generate an email confirmation token and dispatch
    // it to the account's email address.
    const account = await this.accountManager.getAccount(did, {
      includeDeactivated: true,
      includeTakenDown: true,
    })
    if (!account) {
      throw new InvalidRequestError('Account not found')
    }
    if (!account.email) {
      throw new InvalidRequestError('Account does not have an email address')
    }

    const token = await this.accountManager.createEmailToken(
      did,
      'delete_account',
    )
    await this.mailer.sendAccountDelete(
      { token, locale },
      { to: account.email },
    )
  }

  async deleteAccountConfirm({
    did,
    token,
    password,
  }: DeleteAccountConfirmInput): Promise<void> {
    // Mirror the XRPC `com.atproto.server.deleteAccount` flow (no-entryway
    // path): verify the password, validate the email confirmation token,
    // destroy the actor store, delete the account row, and emit the
    // tombstone account event.
    const account = await this.accountManager.getAccount(did, {
      includeDeactivated: true,
      includeTakenDown: true,
    })
    if (!account) {
      throw new InvalidRequestError('Account not found')
    }

    const validPass = await this.accountManager.verifyAccountPassword(
      did,
      password,
    )
    if (!validPass) {
      throw new InvalidCredentialsError('Invalid did or password', did)
    }

    await this.accountManager.assertValidEmailToken(
      did,
      'delete_account',
      token,
    )

    // @NOTE Order matters here: first "unlink" the account by removing it
    // from the account manager database ("source of truth"), then notify the
    // sequencer, and finally cleanup files from the file system.
    await this.accountManager.deleteAccount(did)
    try {
      await this.sequencer.sequenceAccountDeletion(did)
    } finally {
      await this.actorStore.destroy(did)
    }
  }

  private async toTokenInfo(
    row: ActorAccount & Selectable<schemas.Token>,
  ): Promise<TokenInfo> {
    return {
      id: row.tokenId,
      data: tokenHelper.toTokenData(row),
      account: await this.buildAccount(row),
      currentRefreshToken: row.currentRefreshToken,
    }
  }

  private async buildAccount(row: ActorAccount): Promise<Account> {
    const account: Account = {
      did: row.did,
      pds: this.serviceDid,
      email: row.email || undefined,
      emailVerified: row.email ? row.emailConfirmedAt != null : undefined,
      handle: row.handle || undefined,
      deactivated: row.deactivatedAt != null,
    }

    if (!account.name || !account.picture) {
      const { did } = account

      const profile = await this.actorStore
        .read(did, async (store) => {
          return store.record.getProfileRecord()
        })
        .catch((err) => {
          dbLogger.error({ err }, 'Failed to get profile record')
          return null // No need to propagate
        })

      if (profile) {
        const { avatar, displayName } = profile

        account.name ||= displayName
        account.picture ||= avatar
          ? this.imageUrlBuilder.build('avatar', did, getBlobCidString(avatar))
          : undefined
      }
    }

    return account
  }
}

function toHandleUnavailableError(err: unknown): unknown {
  if (err instanceof XrpcInvalidRequestError) {
    const reason = toHandleUnavailableReason(err)
    if (reason) throw new HandleUnavailableError(reason, err.message, err)

    return new InvalidRequestError(err.message, err)
  }

  return err
}

/**
 * This function maps specific `XrpcInvalidRequestError`, thrown by the
 * `AccountManager` when validating a handle, to a more specific
 * `HandleUnavailableError` with a reason. This allows the OAuthProvider to
 * provide properly localized and specific error messages to the user when a
 * handle is not available.
 */
function toHandleUnavailableReason(
  err: XrpcInvalidRequestError,
): HandleUnavailableReason | undefined {
  switch (err.error) {
    case 'HandleNotAvailable': {
      if (err.message === 'Reserved handle') return 'reserved'
      return 'taken'
    }

    case 'UnsupportedDomain': {
      return 'unsupported'
    }

    case 'InvalidHandle': {
      if (err.message === 'Inappropriate language in handle') return 'slur'
      if (err.message === 'Handle TLD is invalid or disallowed') return 'domain'
      return 'syntax'
    }

    case 'InvalidRequest': {
      if (err.message === 'External handle did not resolve to DID') {
        return 'resolution'
      }
      return undefined
    }
  }
}
