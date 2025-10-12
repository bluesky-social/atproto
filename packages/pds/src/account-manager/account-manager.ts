import { KeyObject } from 'node:crypto'
import { CID } from 'multiformats/cid'
import { HOUR, wait } from '@atproto/common'
import { IdResolver } from '@atproto/identity'
import { isValidTld } from '@atproto/syntax'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AuthScope } from '../auth-scope'
import { softDeleted } from '../db'
import { hasExplicitSlur } from '../handle/explicit-slurs'
import {
  baseNormalizeAndValidate,
  ensureHandleServiceConstraints,
  isServiceDomain,
} from '../handle/index'
import { StatusAttr } from '../lexicon/types/com/atproto/admin/defs'
import { AccountDb, EmailTokenPurpose, getDb, getMigrator } from './db'
import * as account from './helpers/account'
import { AccountStatus, ActorAccount } from './helpers/account'
import * as auth from './helpers/auth'
import * as emailToken from './helpers/email-token'
import * as invite from './helpers/invite'
import * as password from './helpers/password'
import * as repo from './helpers/repo'
import * as scrypt from './helpers/scrypt'
import * as token from './helpers/token'

export { AccountStatus, formatAccountStatus } from './helpers/account'

export type AccountManagerDbConfig = {
  accountDbLoc: string
  disableWalAutoCheckpoint: boolean
}

export class AccountManager {
  readonly db: AccountDb

  constructor(
    readonly idResolver: IdResolver,
    readonly jwtKey: KeyObject,
    readonly serviceDid: string,
    readonly serviceHandleDomains: string[],
    db: AccountManagerDbConfig,
  ) {
    this.db = getDb(db.accountDbLoc, db.disableWalAutoCheckpoint)
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

  async getAccounts(
    dids: string[],
    flags?: account.AvailabilityFlags,
  ): Promise<Map<string, ActorAccount>> {
    return account.getAccounts(this.db, dids, flags)
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

  async normalizeAndValidateHandle(
    handle: string,
    {
      did,
      allowAnyValid,
    }: {
      did?: string
      allowAnyValid?: boolean
    } = {},
  ): Promise<string> {
    const normalized = baseNormalizeAndValidate(handle)

    // tld validation
    if (!isValidTld(normalized)) {
      throw new InvalidRequestError(
        'Handle TLD is invalid or disallowed',
        'InvalidHandle',
      )
    }
    // slur check
    if (!allowAnyValid && hasExplicitSlur(normalized)) {
      throw new InvalidRequestError(
        'Inappropriate language in handle',
        'InvalidHandle',
      )
    }
    if (isServiceDomain(normalized, this.serviceHandleDomains)) {
      // verify constraints on a service domain
      ensureHandleServiceConstraints(
        normalized,
        this.serviceHandleDomains,
        allowAnyValid,
      )
    } else {
      if (did == null) {
        throw new InvalidRequestError(
          'Not a supported handle domain',
          'UnsupportedDomain',
        )
      }
      // verify resolution of a non-service domain
      const resolvedDid = await this.idResolver.handle.resolve(normalized)
      if (resolvedDid !== did) {
        throw new InvalidRequestError('External handle did not resolve to DID')
      }
    }

    return normalized
  }

  async createAccount({
    did,
    handle,
    email,
    password,
    repoCid,
    repoRev,
    inviteCode,
    deactivated,
    refreshJwt,
  }: {
    did: string
    handle: string
    email?: string
    password?: string
    repoCid: CID
    repoRev: string
    inviteCode?: string
    deactivated?: boolean
    refreshJwt?: string
  }) {
    if (password && password.length > scrypt.NEW_PASSWORD_MAX_LENGTH) {
      throw new InvalidRequestError('Password too long')
    }

    const passwordScrypt = password
      ? await scrypt.genSaltAndHash(password)
      : undefined

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
        refreshJwt &&
          auth.storeRefreshToken(
            dbTxn,
            auth.decodeRefreshToken(refreshJwt),
            null,
          ),
        repo.updateRoot(dbTxn, did, repoCid, repoRev),
      ])
    })
  }

  async createAccountAndSession(opts: {
    did: string
    handle: string
    email?: string
    password?: string
    repoCid: CID
    repoRev: string
    inviteCode?: string
    deactivated?: boolean
  }) {
    const { accessJwt, refreshJwt } = await auth.createTokens({
      did: opts.did,
      jwtKey: this.jwtKey,
      serviceDid: this.serviceDid,
      scope: AuthScope.Access,
    })

    await this.createAccount({ ...opts, refreshJwt })

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
    isSoftDeleted = false,
  ) {
    const { accessJwt, refreshJwt } = await auth.createTokens({
      did,
      jwtKey: this.jwtKey,
      serviceDid: this.serviceDid,
      scope: auth.formatScope(appPassword, isSoftDeleted),
    })
    // For soft deleted accounts don't store refresh token so that it can't be rotated.
    if (!isSoftDeleted) {
      const refreshPayload = auth.decodeRefreshToken(refreshJwt)
      await auth.storeRefreshToken(this.db, refreshPayload, appPassword)
    }
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
    isSoftDeleted: boolean
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
      const isSoftDeleted = softDeleted(user)

      let appPassword: password.AppPassDescript | null = null
      const validAccountPass = await this.verifyAccountPassword(
        user.did,
        password,
      )
      if (!validAccountPass) {
        // takendown/suspended accounts cannot login with app password
        if (isSoftDeleted) {
          throw new AuthRequiredError('Invalid identifier or password')
        }
        appPassword = await this.verifyAppPassword(user.did, password)
        if (appPassword === null) {
          throw new AuthRequiredError('Invalid identifier or password')
        }
      }

      return { user, appPassword, isSoftDeleted }
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
    const inviteCodes = await invite.getAccountsInviteCodes(this.db, [did])
    return inviteCodes.get(did) ?? []
  }

  async getAccountsInvitesCodes(dids: string[]) {
    return invite.getAccountsInviteCodes(this.db, dids)
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

    return did
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
}
