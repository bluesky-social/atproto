import { KeyObject } from 'node:crypto'
import { HOUR, wait } from '@atproto/common'
import {
  AccountInfo,
  AccountStore,
  Code,
  DeviceData,
  DeviceId,
  FoundRequestResult,
  LoginCredentials,
  NewTokenData,
  RefreshToken,
  RequestData,
  RequestId,
  RequestStore,
  DeviceStore,
  TokenData,
  TokenId,
  TokenInfo,
  TokenStore,
  UpdateRequestData,
} from '@atproto/oauth-provider'
import { AuthRequiredError } from '@atproto/xrpc-server'
import { CID } from 'multiformats/cid'

import { AuthScope } from '../auth-verifier'
import { softDeleted } from '../db'
import { StatusAttr } from '../lexicon/types/com/atproto/admin/defs'
import { AccountDb, EmailTokenPurpose, getDb, getMigrator } from './db'
import * as account from './helpers/account'
import { ActorAccount } from './helpers/account'
import * as auth from './helpers/auth'
import * as authorizationRequest from './helpers/authorization-request.js'
import * as device from './helpers/device.js'
import * as deviceAccount from './helpers/device-account.js'
import * as emailToken from './helpers/email-token'
import * as invite from './helpers/invite'
import * as password from './helpers/password'
import * as repo from './helpers/repo'
import * as scrypt from './helpers/scrypt'
import * as token from './helpers/token.js'
import * as usedRefreshToken from './helpers/used-refresh-token.js'

export class AccountManager
  implements AccountStore, RequestStore, DeviceStore, TokenStore
{
  db: AccountDb

  constructor(
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

  // Repo exists and is not taken-down
  async isRepoAvailable(did: string) {
    const got = await this.getAccount(did)
    return !!got
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
    await this.db.transaction((dbTxn) =>
      Promise.all([
        account.updateAccountTakedownStatus(dbTxn, did, takedown),
        auth.revokeRefreshTokensByDid(dbTxn, did),
      ]),
    )
  }

  async getAccountTakedownStatus(did: string) {
    return account.getAccountTakedownStatus(this.db, did)
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

  async createSession(did: string, appPasswordName: string | null) {
    const { accessJwt, refreshJwt } = await auth.createTokens({
      did,
      jwtKey: this.jwtKey,
      serviceDid: this.serviceDid,
      scope: appPasswordName === null ? AuthScope.Access : AuthScope.AppPass,
    })
    const refreshPayload = auth.decodeRefreshToken(refreshJwt)
    await auth.storeRefreshToken(this.db, refreshPayload, appPasswordName)
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
      scope:
        token.appPasswordName === null ? AuthScope.Access : AuthScope.AppPass,
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
          auth.storeRefreshToken(dbTxn, refreshPayload, token.appPasswordName),
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

  async login(
    { identifier, password }: { identifier: string; password: string },
    allowAppPassword = false,
  ): Promise<{
    user: ActorAccount
    appPasswordName: string | null
  }> {
    const start = Date.now()
    try {
      const identifierNormalized = identifier.toLowerCase()
      const user = identifier.includes('@')
        ? await this.getAccountByEmail(identifierNormalized, {
            includeDeactivated: true,
            includeTakenDown: true,
          })
        : await this.getAccount(identifierNormalized, {
            includeDeactivated: true,
            includeTakenDown: true,
          })

      if (!user) throw new AuthRequiredError('Invalid identifier or password')

      let appPasswordName: string | null = null
      const validAccountPass = await this.verifyAccountPassword(
        user.did,
        password,
      )
      if (!validAccountPass) {
        if (allowAppPassword) {
          appPasswordName = await this.verifyAppPassword(user.did, password)
        }
        if (appPasswordName === null) {
          throw new AuthRequiredError('Invalid identifier or password')
        }
      }

      if (softDeleted(user)) {
        throw new AuthRequiredError(
          'Account has been taken down',
          'AccountTakedown',
        )
      }

      return { user, appPasswordName }
    } finally {
      // Mitigate timing attacks
      await wait(350 - (Date.now() - start))
    }
  }

  // Passwords
  // ----------

  async createAppPassword(did: string, name: string) {
    return password.createAppPassword(this.db, did, name)
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
  ): Promise<string | null> {
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
    { username: identifier, password, remember = false }: LoginCredentials,
    deviceId: DeviceId,
  ): Promise<AccountInfo | null> {
    try {
      const { user } = await this.login({ identifier, password }, false)

      await deviceAccount.createOrUpdate(this.db, deviceId, user.did, remember)

      return deviceAccount.get(this.db, deviceId, user.did, this.serviceDid)
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
      const authorizedClients = await deviceAccount.getAuthorizedClients(
        dbTxn,
        deviceId,
        sub,
      )

      if (authorizedClients.includes(clientId)) return

      await deviceAccount.update(dbTxn, deviceId, sub, {
        authorizedClients: [...authorizedClients, clientId],
      })
    })
  }

  async getDeviceAccount(
    deviceId: DeviceId,
    sub: string,
  ): Promise<AccountInfo | null> {
    return deviceAccount.get(this.db, deviceId, sub, this.serviceDid)
  }

  async listDeviceAccounts(deviceId: DeviceId): Promise<AccountInfo[]> {
    return deviceAccount.listRemembered(this.db, deviceId, this.serviceDid)
  }

  async removeDeviceAccount(deviceId: DeviceId, sub: string): Promise<void> {
    return deviceAccount.remove(this.db, deviceId, sub)
  }

  // RequestStore

  async createRequest(id: RequestId, data: RequestData): Promise<void> {
    await authorizationRequest.create(this.db, id, data)
  }

  async readRequest(id: RequestId): Promise<RequestData | null> {
    try {
      return authorizationRequest.get(this.db, id)
    } finally {
      // Take the opportunity to clean up expired requests. Do this after we got
      // the current (potentially expired) request data to allow the provider to
      // handle expired requests.

      // TODO: Do this less often?
      await authorizationRequest.deleteOldExpired(this.db)
    }
  }

  async updateRequest(id: RequestId, data: UpdateRequestData): Promise<void> {
    await authorizationRequest.update(this.db, id, data)
  }

  async deleteRequest(id: RequestId): Promise<void> {
    await authorizationRequest.deleteById(this.db, id)
  }

  async findRequestByCode(code: Code): Promise<FoundRequestResult | null> {
    return authorizationRequest.findByCode(this.db, code)
  }

  // DeviceStore

  async createDevice(deviceId: DeviceId, data: DeviceData): Promise<void> {
    await device.create(this.db, deviceId, data)
  }

  async readDevice(deviceId: DeviceId): Promise<null | DeviceData> {
    return device.getById(this.db, deviceId)
  }

  async updateDevice(
    deviceId: DeviceId,
    data: Partial<DeviceData>,
  ): Promise<void> {
    await device.update(this.db, deviceId, data)
  }

  async deleteDevice(deviceId: DeviceId): Promise<void> {
    await device.remove(this.db, deviceId)

    // TODO: can use use foreign key constraint to delete this row ?
    await deviceAccount.removeByDevice(this.db, deviceId)
  }

  // TokenStore

  async createToken(
    id: TokenId,
    data: TokenData,
    refreshToken?: RefreshToken,
  ): Promise<void> {
    await token.create(this.db, id, data, refreshToken)
  }

  async readToken(tokenId: TokenId): Promise<TokenInfo | null> {
    return token.findBy(this.db, { tokenId }, this.serviceDid)
  }

  async deleteToken(tokenId: TokenId): Promise<void> {
    await token.remove(this.db, tokenId)
  }

  async rotateToken(
    tokenId: TokenId,
    newTokenId: TokenId,
    newRefreshToken: RefreshToken,
    newData: NewTokenData,
  ): Promise<void> {
    // No transaction because we want to make sure that the token is added
    // to the used refresh tokens even if the rotate() fails.

    const { id, currentRefreshToken } = await token.getForRefresh(
      this.db,
      tokenId,
    )

    if (currentRefreshToken) {
      await usedRefreshToken.insert(this.db, id, currentRefreshToken)
    }

    await token.rotate(this.db, id, newTokenId, newRefreshToken, newData)
  }

  async findTokenByRefreshToken(
    refreshToken: RefreshToken,
  ): Promise<TokenInfo | null> {
    const id = await usedRefreshToken.findByToken(this.db, refreshToken)
    return token.findBy(
      this.db,
      id ? { id } : { currentRefreshToken: refreshToken },
      this.serviceDid,
    )
  }

  async findTokenByCode(code: Code): Promise<TokenInfo | null> {
    return token.findByCode(this.db, code, this.serviceDid)
  }
}
