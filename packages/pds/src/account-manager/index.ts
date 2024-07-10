import { HOUR, wait } from '@atproto/common'
import {
  AccountInfo,
  AccountStore,
  Code,
  DeviceData,
  DeviceId,
  DeviceStore,
  FoundRequestResult,
  NewTokenData,
  RefreshToken,
  RequestData,
  RequestId,
  RequestStore,
  SignInCredentials,
  TokenData,
  TokenId,
  TokenInfo,
  TokenStore,
  UpdateRequestData,
} from '@atproto/oauth-provider'
import { AuthRequiredError } from '@atproto/xrpc-server'
import { CID } from 'multiformats/cid'
import { KeyObject } from 'node:crypto'

import { AuthScope } from '../auth-verifier'
import { BackgroundQueue } from '../background'
import { softDeleted } from '../db'
import { StatusAttr } from '../lexicon/types/com/atproto/admin/defs'
import { AccountDb, EmailTokenPurpose, getDb, getMigrator } from './db'
import * as account from './helpers/account'
import { AccountStatus, ActorAccount } from './helpers/account'
import * as auth from './helpers/auth'
import * as authRequest from './helpers/authorization-request'
import * as device from './helpers/device'
import * as deviceAccount from './helpers/device-account'
import * as emailToken from './helpers/email-token'
import * as invite from './helpers/invite'
import * as password from './helpers/password'
import * as repo from './helpers/repo'
import * as scrypt from './helpers/scrypt'
import * as token from './helpers/token'
import * as usedRefreshToken from './helpers/used-refresh-token'

export { AccountStatus, formatAccountStatus } from './helpers/account'

export class AccountManager
  implements AccountStore, RequestStore, DeviceStore, TokenStore
{
  db: AccountDb

  constructor(
    private backgroundQueue: BackgroundQueue,
    dbLocation: string,
    private jwtKey: KeyObject,
    private serviceDid: string,
    disableWalAutoCheckpoint = false,
  ) {
    this.db = getDb(dbLocation, disableWalAutoCheckpoint)
  }

  async migrateOrThrow() {
    await this.db.ensureWal()
    await getMigrator(this.db).migrateToLatestOrThrow()
  }

  close() {
    this.db.close()
  }

  // Account
  // ----------

  async getAccount(
    handleOrDid: string,
    flags?: account.AvailabilityFlags,
  ): Promise<ActorAccount | null> {
    return account.getAccount(this.db, handleOrDid, flags)
  }

  async getAccountByEmail(
    email: string,
    flags?: account.AvailabilityFlags,
  ): Promise<ActorAccount | null> {
    return account.getAccountByEmail(this.db, email, flags)
  }

  async isAccountActivated(did: string): Promise<boolean> {
    const account = await this.getAccount(did, { includeDeactivated: true })
    if (!account) return false
    return !account.deactivatedAt
  }

  async getDidForActor(
    handleOrDid: string,
    flags?: account.AvailabilityFlags,
  ): Promise<string | null> {
    const got = await this.getAccount(handleOrDid, flags)
    return got?.did ?? null
  }

  async getAccountStatus(handleOrDid: string): Promise<AccountStatus> {
    const got = await this.getAccount(handleOrDid, {
      includeDeactivated: true,
      includeTakenDown: true,
    })

    const res = account.formatAccountStatus(got)
    return res.active ? AccountStatus.Active : res.status
  }

  async createAccount(opts: {
    did: string
    handle: string
    email?: string
    password?: string
    repoCid: CID
    repoRev: string
    inviteCode?: string
    deactivated?: boolean
  }) {
    const {
      did,
      handle,
      email,
      password,
      repoCid,
      repoRev,
      inviteCode,
      deactivated,
    } = opts
    const passwordScrypt = password
      ? await scrypt.genSaltAndHash(password)
      : undefined

    const { accessJwt, refreshJwt } = await auth.createTokens({
      did,
      jwtKey: this.jwtKey,
      serviceDid: this.serviceDid,
      scope: AuthScope.Access,
    })
    const refreshPayload = auth.decodeRefreshToken(refreshJwt)
    const now = new Date().toISOString()
    await this.db.transaction(async (dbTxn) => {
      if (inviteCode) {
        await invite.ensureInviteIsAvailable(dbTxn, inviteCode)
      }
      await Promise.all([
        account.registerActor(dbTxn, { did, handle, deactivated }),
        email && passwordScrypt
          ? account.registerAccount(dbTxn, { did, email, passwordScrypt })
          : Promise.resolve(),
        invite.recordInviteUse(dbTxn, {
          did,
          inviteCode,
          now,
        }),
        auth.storeRefreshToken(dbTxn, refreshPayload, null),
        repo.updateRoot(dbTxn, did, repoCid, repoRev),
      ])
    })
    return { accessJwt, refreshJwt }
  }

  // @NOTE should always be paired with a sequenceHandle().
  // the token output from this method should be passed to sequenceHandle().
  async updateHandle(did: string, handle: string) {
    return account.updateHandle(this.db, did, handle)
  }

  async deleteAccount(did: string) {
    return account.deleteAccount(this.db, did)
  }

  async takedownAccount(did: string, takedown: StatusAttr) {
    await this.db.transaction(async (dbTxn) =>
      Promise.all([
        account.updateAccountTakedownStatus(dbTxn, did, takedown),
        auth.revokeRefreshTokensByDid(dbTxn, did),
        token.removeByDidQB(dbTxn, did).execute(),
      ]),
    )
  }

  async getAccountAdminStatus(did: string) {
    return account.getAccountAdminStatus(this.db, did)
  }

  async updateRepoRoot(did: string, cid: CID, rev: string) {
    return repo.updateRoot(this.db, did, cid, rev)
  }

  async deactivateAccount(did: string, deleteAfter: string | null) {
    return account.deactivateAccount(this.db, did, deleteAfter)
  }

  async activateAccount(did: string) {
    return account.activateAccount(this.db, did)
  }

  // Auth
  // ----------

  async createSession(
    did: string,
    appPassword: password.AppPassDescript | null,
  ) {
    const { accessJwt, refreshJwt } = await auth.createTokens({
      did,
      jwtKey: this.jwtKey,
      serviceDid: this.serviceDid,
      scope: auth.formatScope(appPassword),
    })
    const refreshPayload = auth.decodeRefreshToken(refreshJwt)
    await auth.storeRefreshToken(this.db, refreshPayload, appPassword)
    return { accessJwt, refreshJwt }
  }

  async rotateRefreshToken(id: string) {
    const token = await auth.getRefreshToken(this.db, id)
    if (!token) return null

    const now = new Date()

    // take the chance to tidy all of a user's expired tokens
    // does not need to be transactional since this is just best-effort
    await auth.deleteExpiredRefreshTokens(this.db, token.did, now.toISOString())

    // Shorten the refresh token lifespan down from its
    // original expiration time to its revocation grace period.
    const prevExpiresAt = new Date(token.expiresAt)
    const REFRESH_GRACE_MS = 2 * HOUR
    const graceExpiresAt = new Date(now.getTime() + REFRESH_GRACE_MS)

    const expiresAt =
      graceExpiresAt < prevExpiresAt ? graceExpiresAt : prevExpiresAt

    if (expiresAt <= now) {
      return null
    }

    // Determine the next refresh token id: upon refresh token
    // reuse you always receive a refresh token with the same id.
    const nextId = token.nextId ?? auth.getRefreshTokenId()

    const { accessJwt, refreshJwt } = await auth.createTokens({
      did: token.did,
      jwtKey: this.jwtKey,
      serviceDid: this.serviceDid,
      scope: auth.formatScope(token.appPassword),
      jti: nextId,
    })

    const refreshPayload = auth.decodeRefreshToken(refreshJwt)
    try {
      await this.db.transaction((dbTxn) =>
        Promise.all([
          auth.addRefreshGracePeriod(dbTxn, {
            id,
            expiresAt: expiresAt.toISOString(),
            nextId,
          }),
          auth.storeRefreshToken(dbTxn, refreshPayload, token.appPassword),
        ]),
      )
    } catch (err) {
      if (err instanceof auth.ConcurrentRefreshError) {
        return this.rotateRefreshToken(id)
      }
      throw err
    }
    return { accessJwt, refreshJwt }
  }

  async revokeRefreshToken(id: string) {
    return auth.revokeRefreshToken(this.db, id)
  }

  // Login
  // ----------

  async login({
    identifier,
    password,
  }: {
    identifier: string
    password: string
  }): Promise<{
    user: ActorAccount
    appPassword: password.AppPassDescript | null
  }> {
    const start = Date.now()
    try {
      const identifierNormalized = identifier.toLowerCase()

      const user = identifierNormalized.includes('@')
        ? await this.getAccountByEmail(identifierNormalized, {
            includeDeactivated: true,
            includeTakenDown: true,
          })
        : await this.getAccount(identifierNormalized, {
            includeDeactivated: true,
            includeTakenDown: true,
          })

      if (!user) {
        throw new AuthRequiredError('Invalid identifier or password')
      }

      let appPassword: password.AppPassDescript | null = null
      const validAccountPass = await this.verifyAccountPassword(
        user.did,
        password,
      )
      if (!validAccountPass) {
        appPassword = await this.verifyAppPassword(user.did, password)
        if (appPassword === null) {
          throw new AuthRequiredError('Invalid identifier or password')
        }
      }

      if (softDeleted(user)) {
        throw new AuthRequiredError(
          'Account has been taken down',
          'AccountTakedown',
        )
      }

      return { user, appPassword }
    } finally {
      // Mitigate timing attacks
      await wait(350 - (Date.now() - start))
    }
  }

  // Passwords
  // ----------

  async createAppPassword(did: string, name: string, privileged: boolean) {
    return password.createAppPassword(this.db, did, name, privileged)
  }

  async listAppPasswords(did: string) {
    return password.listAppPasswords(this.db, did)
  }

  async verifyAccountPassword(
    did: string,
    passwordStr: string,
  ): Promise<boolean> {
    return password.verifyAccountPassword(this.db, did, passwordStr)
  }

  async verifyAppPassword(
    did: string,
    passwordStr: string,
  ): Promise<password.AppPassDescript | null> {
    return password.verifyAppPassword(this.db, did, passwordStr)
  }

  async revokeAppPassword(did: string, name: string) {
    await this.db.transaction(async (dbTxn) =>
      Promise.all([
        password.deleteAppPassword(dbTxn, did, name),
        auth.revokeAppPasswordRefreshToken(dbTxn, did, name),
      ]),
    )
  }

  // Invites
  // ----------

  async ensureInviteIsAvailable(code: string) {
    return invite.ensureInviteIsAvailable(this.db, code)
  }

  async createInviteCodes(
    toCreate: { account: string; codes: string[] }[],
    useCount: number,
  ) {
    return invite.createInviteCodes(this.db, toCreate, useCount)
  }

  async createAccountInviteCodes(
    forAccount: string,
    codes: string[],
    expectedTotal: number,
    disabled: 0 | 1,
  ) {
    return invite.createAccountInviteCodes(
      this.db,
      forAccount,
      codes,
      expectedTotal,
      disabled,
    )
  }

  async getAccountInvitesCodes(did: string) {
    return invite.getAccountInviteCodes(this.db, did)
  }

  async getInvitedByForAccounts(dids: string[]) {
    return invite.getInvitedByForAccounts(this.db, dids)
  }

  async getInviteCodesUses(codes: string[]) {
    return invite.getInviteCodesUses(this.db, codes)
  }

  async setAccountInvitesDisabled(did: string, disabled: boolean) {
    return invite.setAccountInvitesDisabled(this.db, did, disabled)
  }

  async disableInviteCodes(opts: { codes: string[]; accounts: string[] }) {
    return invite.disableInviteCodes(this.db, opts)
  }

  // Email Tokens
  // ----------

  async createEmailToken(did: string, purpose: EmailTokenPurpose) {
    return emailToken.createEmailToken(this.db, did, purpose)
  }

  async assertValidEmailToken(
    did: string,
    purpose: EmailTokenPurpose,
    token: string,
  ) {
    return emailToken.assertValidToken(this.db, did, purpose, token)
  }

  async assertValidEmailTokenAndCleanup(
    did: string,
    purpose: EmailTokenPurpose,
    token: string,
  ) {
    await emailToken.assertValidToken(this.db, did, purpose, token)
    await emailToken.deleteEmailToken(this.db, did, purpose)
  }

  async confirmEmail(opts: { did: string; token: string }) {
    const { did, token } = opts
    await emailToken.assertValidToken(this.db, did, 'confirm_email', token)
    const now = new Date().toISOString()
    await this.db.transaction((dbTxn) =>
      Promise.all([
        emailToken.deleteEmailToken(dbTxn, did, 'confirm_email'),
        account.setEmailConfirmedAt(dbTxn, did, now),
      ]),
    )
  }

  async updateEmail(opts: { did: string; email: string }) {
    const { did, email } = opts
    await this.db.transaction((dbTxn) =>
      Promise.all([
        account.updateEmail(dbTxn, did, email),
        emailToken.deleteAllEmailTokens(dbTxn, did),
      ]),
    )
  }

  async resetPassword(opts: { password: string; token: string }) {
    const did = await emailToken.assertValidTokenAndFindDid(
      this.db,
      'reset_password',
      opts.token,
    )
    await this.updateAccountPassword({ did, password: opts.password })
  }

  async updateAccountPassword(opts: { did: string; password: string }) {
    const { did } = opts
    const passwordScrypt = await scrypt.genSaltAndHash(opts.password)
    await this.db.transaction(async (dbTxn) =>
      Promise.all([
        password.updateUserPassword(dbTxn, { did, passwordScrypt }),
        emailToken.deleteEmailToken(dbTxn, did, 'reset_password'),
        auth.revokeRefreshTokensByDid(dbTxn, did),
      ]),
    )
  }

  // AccountStore

  async authenticateAccount(
    { username: identifier, password, remember = false }: SignInCredentials,
    deviceId: DeviceId,
  ): Promise<AccountInfo | null> {
    try {
      const { user, appPassword } = await this.login({ identifier, password })

      if (appPassword) {
        throw new AuthRequiredError('App passwords are not allowed')
      }

      await this.db.executeWithRetry(
        deviceAccount.createOrUpdateQB(this.db, deviceId, user.did, remember),
      )

      return await this.getDeviceAccount(deviceId, user.did)
    } catch (err) {
      if (err instanceof AuthRequiredError) return null
      throw err
    }
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
      account: deviceAccount.toAccount(row, this.serviceDid),
      info: deviceAccount.toDeviceAccountInfo(row),
    }
  }

  async listDeviceAccounts(deviceId: DeviceId): Promise<AccountInfo[]> {
    const rows = await deviceAccount
      .listRememberedQB(this.db, deviceId)
      .execute()

    return rows.map((row) => ({
      account: deviceAccount.toAccount(row, this.serviceDid),
      info: deviceAccount.toDeviceAccountInfo(row),
    }))
  }

  async removeDeviceAccount(deviceId: DeviceId, sub: string): Promise<void> {
    await this.db.executeWithRetry(
      deviceAccount.removeQB(this.db, deviceId, sub),
    )
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
