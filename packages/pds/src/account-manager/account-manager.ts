import assert from 'node:assert'
import type { KeyObject } from 'node:crypto'
import type { Client as PlcClient } from '@did-plc/lib'
import { isEmailValid } from '@hapi/address'
import { isDisposableEmail } from 'disposable-email-domains-js'
import { HOUR, obfuscateEmail, wait } from '@atproto/common'
import type { Keypair } from '@atproto/crypto'
import type { IdResolver } from '@atproto/identity'
import {
  type AtIdentifierString,
  type DidString,
  type HandleString,
  isAtIdentifierString,
} from '@atproto/lex'
import type { Cid } from '@atproto/lex-data'
import {
  INVALID_HANDLE,
  asDatetimeString,
  currentDatetimeString,
  isValidTld,
} from '@atproto/syntax'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import type { ActorStore } from '../actor-store/actor-store.js'
import { assertValidDidDocumentForService } from '../api/com/atproto/server/util.js'
import { AuthScope } from '../auth-scope.js'
import type { ServerConfig } from '../config/config.js'
import { softDeleted } from '../db/index.js'
import { hasExplicitSlur } from '../handle/explicit-slurs.js'
import {
  baseNormalizeAndValidate,
  ensureHandleServiceConstraints,
  isServiceDomain,
} from '../handle/index.js'
import type { com } from '../lexicons/index.js'
import { httpLogger } from '../logger.js'
import type { ServerMailer } from '../mailer/index.js'
import type { Sequencer } from '../sequencer/index.js'
import {
  type AccountDb,
  type EmailTokenPurpose,
  getDb,
  getMigrator,
} from './db/index.js'
import * as accountHelpers from './helpers/account.js'
import { AccountStatus, type ActorAccount } from './helpers/account.js'
import * as auth from './helpers/auth.js'
import * as authorizedClientHelper from './helpers/authorized-client.js'
import * as emailToken from './helpers/email-token.js'
import * as invite from './helpers/invite.js'
import * as password from './helpers/password.js'
import * as repo from './helpers/repo.js'
import * as scrypt from './helpers/scrypt.js'
import * as token from './helpers/token.js'

export { AccountStatus, formatAccountStatus } from './helpers/account.js'

/**
 * Thrown by {@link AccountManager.login} when the identifier resolved to a
 * known account but the supplied credentials (account password / app
 * password) did not match. The matched `did` is attached so downstream
 * callers can distinguish "identifier known, credentials wrong" from
 * "identifier unknown" (which continues to throw a plain
 * {@link AuthRequiredError}).
 *
 * Callers should take care that remote clients *cannot* distinguish the above,
 * to prevent enumeration attacks. (Tested for in
 * packages/pds/tests/auth.test.ts)
 */
export class InvalidPasswordError extends AuthRequiredError {
  constructor(
    public readonly did: DidString,
    errorMessage = 'Invalid identifier or password',
  ) {
    super(errorMessage)
  }
}

/**
 * Thrown by {@link AccountManager.login} when the credentials were valid but
 * the account requires a second authentication factor. A one-time code has
 * already been dispatched by the time this is thrown.
 *
 * XRPC-native like every other error this class raises: `AuthFactorTokenRequired`
 * is the error name `com.atproto.server.createSession` declares, so that path
 * needs no translation. The OAuth boundary ({@link OAuthStore.authenticateAccount})
 * converts it to `SecondAuthenticationFactorRequiredError` — which is why
 * `factor` and `hint` are carried as fields rather than baked into the message.
 *
 * @NOTE Subclasses {@link AuthRequiredError}, so any `instanceof` check against
 * the base class must come *after* this one — see the ordering note in
 * `OAuthStore.authenticateAccount`.
 */
export class AuthFactorRequiredError extends AuthRequiredError {
  constructor(
    public readonly factor: 'emailOtp',
    public readonly hint: string,
    errorMessage = 'A sign in code has been sent to your email address',
  ) {
    super(errorMessage, 'AuthFactorTokenRequired')
  }
}

export type AccountManagerDbConfig = {
  accountDbLoc: string
  disableWalAutoCheckpoint: boolean
}

export class AccountManager {
  readonly db: AccountDb

  constructor(
    readonly cfg: ServerConfig,
    readonly actorStore: ActorStore,
    readonly idResolver: IdResolver,
    readonly jwtKey: KeyObject,
    readonly mailer: ServerMailer,
    readonly sequencer: Sequencer,
    readonly plcClient: PlcClient,
    readonly plcRotationKey: Keypair,
  ) {
    this.db = getDb(cfg.db.accountDbLoc, cfg.db.disableWalAutoCheckpoint)
  }

  get serviceDid(): DidString {
    return this.cfg.service.did
  }

  get serviceHandleDomains(): string[] {
    return this.cfg.identity.serviceHandleDomains
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
    handleOrDid: AtIdentifierString,
    flags?: accountHelpers.AvailabilityFlags,
  ): Promise<ActorAccount | null> {
    return accountHelpers.getAccount(this.db, handleOrDid, flags)
  }

  async getAccounts(
    dids: DidString[],
    flags?: accountHelpers.AvailabilityFlags,
  ): Promise<Map<string, ActorAccount>> {
    return accountHelpers.getAccounts(this.db, dids, flags)
  }

  async getAccountByEmail(
    email: string,
    flags?: accountHelpers.AvailabilityFlags,
  ): Promise<ActorAccount | null> {
    return accountHelpers.getAccountByEmail(this.db, email, flags)
  }

  async isAccountActivated(did: DidString): Promise<boolean> {
    const account = await this.getAccount(did, { includeDeactivated: true })
    if (!account) return false
    return !account.deactivatedAt
  }

  async getDidForActor(
    handleOrDid: AtIdentifierString,
    flags?: accountHelpers.AvailabilityFlags,
  ): Promise<DidString | null> {
    const got = await this.getAccount(handleOrDid, flags)
    return got?.did ?? null
  }

  async getAccountStatus(handleOrDid: AtIdentifierString) {
    const got = await this.getAccount(handleOrDid, {
      includeDeactivated: true,
      includeTakenDown: true,
    })

    const { active, status = active ? AccountStatus.Active : undefined } =
      accountHelpers.formatAccountStatus(got)
    assert(status != null)
    return { status, account: got } as
      | { status: AccountStatus.Deleted; account: null }
      | { status: AccountStatus.Takendown; account: ActorAccount }
      | { status: AccountStatus.Deactivated; account: ActorAccount }
      | { status: AccountStatus.Active; account: ActorAccount }
  }

  async normalizeAndValidateHandle(
    handle: string,
    {
      did,
      allowAnyValid = false,
    }: {
      did?: string
      allowAnyValid?: boolean
    } = {},
  ): Promise<HandleString> {
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
      // When creating an account (no did yet), we require the handle to be a
      // local service domain. Updating to a custom handle will be possible once
      // the account was created.
      if (did == null) {
        throw new InvalidRequestError(
          'Not a supported handle domain',
          'UnsupportedDomain',
        )
      }

      // verify resolution of a non-service domain
      const resolvedDid = await this.idResolver.handle.resolve(normalized)
      if (resolvedDid !== did) {
        // @TODO This should use a distinct error code
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
    did: DidString
    handle: HandleString
    email?: string
    password?: string
    repoCid: Cid
    repoRev: string
    inviteCode?: string
    deactivated?: boolean
    refreshJwt?: string
  }) {
    if (password && password.length > scrypt.NEW_PASSWORD_MAX_LENGTH) {
      throw new InvalidRequestError('Password too long')
    }

    const passwordScrypt =
      email && password ? await scrypt.genSaltAndHash(password) : undefined

    const now = currentDatetimeString()
    return this.db.transaction(async (dbTxn) => {
      if (inviteCode) {
        await invite.ensureInviteIsAvailable(dbTxn, inviteCode)
      }

      await accountHelpers.registerActor(dbTxn, { did, handle, deactivated })

      if (email && passwordScrypt) {
        await accountHelpers.registerAccount(dbTxn, {
          did,
          email,
          passwordScrypt,
        })
      }

      await invite.recordInviteUse(dbTxn, {
        did,
        inviteCode,
        now,
      })

      if (refreshJwt) {
        await auth.storeRefreshToken(
          dbTxn,
          auth.decodeRefreshToken(refreshJwt),
          null,
        )
      }

      await repo.updateRoot(dbTxn, did, repoCid, repoRev)
    })
  }

  async createAccountAndSession(opts: {
    did: DidString
    handle: HandleString
    email?: string
    password?: string
    repoCid: Cid
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

  /**
   * Validates the requested handle, updates the PLC document if needed, persists
   * the new handle locally, and emits an identity event.
   *
   * @throws {InvalidRequestError} when the handle is invalid, taken by another
   * account, or cannot be resolved for non-service domains.
   *
   * @see {@link AccountManager.updateAccountHandle} for behavior when the PLC update fails.
   */
  async updateHandle(
    did: DidString,
    newHandle: string,
    options?: { allowAnyValid?: boolean },
  ): Promise<ActorAccount & { handle: HandleString }> {
    const { account, handle } = await this.validateHandleUpdate(
      did,
      newHandle,
      options,
    )

    if (did.startsWith('did:plc:')) {
      // @TODO We should verify the status before issuing a PLC update.
      await this.plcClient.updateHandle(did, this.plcRotationKey, handle)
    } else {
      const resolved = await this.idResolver.did.resolveAtprotoData(did, true)
      if (resolved.handle !== handle) {
        throw new InvalidRequestError(
          'DID is not properly configured for handle',
        )
      }
    }

    // @NOTE If the next line fails (for any reason), we don't "rollback" the
    // PLC update above. The caller can just call this method again.
    await this.updateAccountHandle(did, handle)

    return { ...account, handle }
  }

  async validateHandleUpdate(
    did: DidString,
    newHandle: string,
    options?: { allowAnyValid?: boolean },
  ): Promise<{
    did: DidString
    handle: HandleString
    // Returned for convenience
    account: ActorAccount
  }> {
    const account = await this.getAccount(did, { includeDeactivated: true })
    if (!account) {
      throw new InvalidRequestError('Account not found')
    }

    const handle = await this.normalizeAndValidateHandle(newHandle, {
      allowAnyValid: options?.allowAnyValid,
      did,
    })

    // Pessimistic check to handle spam: also enforced by updateAccountHandle() and the db.
    const existing = await this.getAccount(handle, {
      includeDeactivated: true,
      includeTakenDown: true,
    })

    if (existing && existing.did !== did) {
      throw new InvalidRequestError(
        `Handle already taken: ${handle}`,
        'HandleNotAvailable',
      )
    }

    return { did, handle, account }
  }

  /**
   * @note Failure to emit the identity event will silently be ignored. Users
   * can emit the event again by updating their handle to the same value.
   */
  async updateAccountHandle(
    did: DidString,
    handle: HandleString,
  ): Promise<void> {
    await accountHelpers.updateHandle(this.db, did, handle)

    try {
      await this.sequencer.sequenceIdentity(did, handle)
    } catch (err) {
      httpLogger.error({ err, did, handle }, 'failed to sequence handle update')
    }
  }

  async deleteAccount(did: DidString) {
    return accountHelpers.deleteAccount(this.db, did)
  }

  async takedownAccount(
    did: DidString,
    takedown: com.atproto.admin.defs.StatusAttr,
  ) {
    await this.db.transaction(async (dbTxn) => {
      await accountHelpers.updateAccountTakedownStatus(dbTxn, did, takedown)
      await auth.revokeRefreshTokensByDid(dbTxn, did)
      await token.removeByDid(dbTxn, did)
    })

    await this.sequenceAccountStatus(did)
  }

  async getAccountAdminStatus(did: DidString) {
    return accountHelpers.getAccountAdminStatus(this.db, did)
  }

  async updateRepoRoot(did: DidString, cid: Cid, rev: string) {
    return repo.updateRoot(this.db, did, cid, rev)
  }

  async deactivateAccount(
    did: DidString,
    options?: {
      deleteCredentials?: boolean
      deleteAfter?: string | null
    },
  ) {
    const wasUpdated = await this.db.transaction(async (dbTxn) => {
      if (options?.deleteCredentials) {
        await token.removeByDid(dbTxn, did)
        await authorizedClientHelper.deleteAllAuthorizedClients(dbTxn, did)
        await password.deleteAllAppPasswords(dbTxn, did)
      }

      return accountHelpers.deactivateAccount(
        dbTxn,
        did,
        options?.deleteAfter ?? null,
      )
    })

    if (!wasUpdated) {
      throw new InvalidRequestError('Account not found')
    }

    const accountStatus = await this.getAccountStatus(did)

    // Account is likely soft-deleted (takendown)
    if (accountStatus.status === AccountStatus.Deleted) {
      throw new InvalidRequestError('Account not found')
    }

    await this.sequencer.sequenceAccount(did, accountStatus.status)

    return accountStatus
  }

  async activateAccount(did: DidString) {
    await assertValidDidDocumentForService(this, did)

    const found = await accountHelpers.activateAccount(this.db, did, {
      // We cannot activate a takendown account
      includeTakenDown: false,
      includeDeactivated: true,
    })
    if (!found) {
      throw new InvalidRequestError('user not found', 'AccountNotFound')
    }

    const accountStatus = await this.getAccountStatus(did)

    const { account, status } = accountStatus

    if (status === AccountStatus.Deleted) {
      // A concurrent operation deleted the account
      throw new InvalidRequestError('user not found', 'AccountNotFound')
    }

    const syncData = await this.actorStore.read(did, (store) => {
      return store.repo.getSyncEventData()
    })

    await this.sequencer.sequenceAccountActivation(
      did,
      account.handle ?? INVALID_HANDLE,
      status,
      syncData,
    )

    return accountStatus
  }

  async sequenceAccountStatus(did: DidString) {
    const { status } = await this.getAccountStatus(did)
    await this.sequencer.sequenceAccount(did, status)
  }

  // Auth
  // ----------

  async createSession(
    did: DidString,
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
    authFactorToken,
    locale,
  }: {
    identifier: string
    password: string
    authFactorToken?: string | undefined
    // Only the OAuth sign-in path carries one; `com.atproto.server.createSession`
    // declares no locale input, so the challenge email falls back to the
    // default template there.
    locale?: string | undefined
  }): Promise<{
    // @TODO we should rename this "account" for consistency
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
        : isAtIdentifierString(identifierNormalized)
          ? await this.getAccount(identifierNormalized, {
              includeDeactivated: true,
              includeTakenDown: true,
            })
          : null

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
          throw new InvalidPasswordError(user.did)
        }
        appPassword = await this.verifyAppPassword(user.did, password)
        if (appPassword === null) {
          throw new InvalidPasswordError(user.did)
        }
      }

      if (authFactorToken) {
        await this.assertValidEmailTokenAndCleanup(
          user.did,
          'auth_factor',
          authFactorToken,
        )
        // require email factor when not using an app password
      } else if (
        user.email !== null &&
        user.emailAuthFactorAt !== null &&
        appPassword === null
      ) {
        const token = await this.createEmailToken(user.did, 'auth_factor')

        await this.mailer.sendSignInAuthFactor(
          { token, handle: user.handle, locale },
          { to: user.email },
        )

        throw new AuthFactorRequiredError(
          'emailOtp',
          obfuscateEmail(user.email),
        )
      }

      return { user, appPassword, isSoftDeleted }
    } finally {
      // Mitigate timing attacks
      await wait(350 - (Date.now() - start))
    }
  }

  // Passwords
  // ----------

  async createAppPassword(did: DidString, name: string, privileged: boolean) {
    return password.createAppPassword(this.db, did, name, privileged)
  }

  async listAppPasswords(did: DidString) {
    return password.listAppPasswords(this.db, did)
  }

  async verifyAccountPassword(
    did: DidString,
    passwordStr: string,
  ): Promise<boolean> {
    if (passwordStr.length > scrypt.OLD_PASSWORD_MAX_LENGTH) {
      // @NOTE Avoid throwing from here to avoid leaking account email validity
      // through error messages.
      return false
    }

    return password.verifyAccountPassword(this.db, did, passwordStr)
  }

  async verifyAppPassword(
    did: DidString,
    passwordStr: string,
  ): Promise<password.AppPassDescript | null> {
    return password.verifyAppPassword(this.db, did, passwordStr)
  }

  async revokeAppPassword(did: DidString, name: string) {
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

  async getAccountInvitesCodes(did: DidString) {
    const inviteCodes = await invite.getAccountsInviteCodes(this.db, [did])
    return inviteCodes.get(did) ?? []
  }

  async getAccountsInvitesCodes(dids: DidString[]) {
    return invite.getAccountsInviteCodes(this.db, dids)
  }

  async getInvitedByForAccounts(dids: DidString[]) {
    return invite.getInvitedByForAccounts(this.db, dids)
  }

  async getInviteCodesUses(codes: string[]) {
    return invite.getInviteCodesUses(this.db, codes)
  }

  async setAccountInvitesDisabled(did: DidString, disabled: boolean) {
    return invite.setAccountInvitesDisabled(this.db, did, disabled)
  }

  async disableInviteCodes(opts: { codes: string[]; accounts: string[] }) {
    return invite.disableInviteCodes(this.db, opts)
  }

  // Email Tokens
  // ----------

  async createEmailToken(did: DidString, purpose: EmailTokenPurpose) {
    return emailToken.createEmailToken(this.db, did, purpose)
  }

  async assertValidEmailToken(
    did: DidString,
    purpose: EmailTokenPurpose,
    token: string,
  ) {
    return emailToken.assertValidToken(this.db, did, purpose, token)
  }

  async assertValidEmailTokenAndCleanup(
    did: DidString,
    purpose: EmailTokenPurpose,
    token: string,
  ) {
    await emailToken.assertValidToken(this.db, did, purpose, token)
    await emailToken.deleteEmailToken(this.db, did, purpose)
  }

  async requestEmailConfirmation(did: DidString, opts?: { locale?: string }) {
    const account = await this.getAccount(did, {
      includeDeactivated: true,
      includeTakenDown: true,
    })

    if (!account) {
      throw new InvalidRequestError('account not found')
    }

    if (!account.email) {
      throw new InvalidRequestError('account does not have an email address')
    }

    const locale = opts?.locale
    const token = await this.createEmailToken(did, 'confirm_email')

    await this.mailer.sendConfirmEmail({ token, locale }, { to: account.email })
  }

  async confirmEmail(did: DidString, email: string, token: string) {
    const user = await this.getAccount(did, {
      includeDeactivated: true,
      includeTakenDown: true,
    })

    if (!user) {
      throw new InvalidRequestError('user not found', 'AccountNotFound')
    }

    if (user.email !== email.toLowerCase()) {
      throw new InvalidRequestError('invalid email', 'InvalidEmail')
    }

    await emailToken.assertValidToken(this.db, did, 'confirm_email', token)
    const now = currentDatetimeString()
    await this.db.transaction(async (dbTxn) => {
      await emailToken.deleteEmailToken(dbTxn, did, 'confirm_email')
      await accountHelpers.setEmailConfirmedAt(dbTxn, did, now)
    })

    user.emailConfirmedAt = now

    return user
  }

  async requestEmailUpdate(
    did: DidString,
    opts?: { locale?: string },
  ): Promise<{ tokenRequired: boolean }> {
    const account = await this.getAccount(did, {
      includeDeactivated: true,
      includeTakenDown: true,
    })

    if (!account) {
      throw new InvalidRequestError('account not found')
    }

    if (!account.email) {
      throw new InvalidRequestError('account does not have an email address')
    }

    const token = account.emailConfirmedAt
      ? await this.createEmailToken(did, 'update_email')
      : null

    if (token) {
      await this.mailer.sendUpdateEmail(
        { token, locale: opts?.locale },
        { to: account.email },
      )
    }

    return { tokenRequired: !!token }
  }

  /**
   * @throws UserAlreadyExistsError if the new email is already in use by another account
   */
  async updateEmail(
    did: DidString,
    email: string,
    token?: string,
    opts?: { locale?: string; sendConfirmationEmail?: boolean },
  ): Promise<ActorAccount> {
    if (!isEmailValid(email) || isDisposableEmail(email)) {
      throw new InvalidRequestError(
        'This email address is not supported, please use a different email.',
      )
    }

    const account = await this.getAccount(did, {
      includeDeactivated: true,
      includeTakenDown: true,
    })

    if (!account) {
      throw new InvalidRequestError('account not found')
    }

    const tokenRequired = !!account.emailConfirmedAt

    // require a token if account email is confirmed
    if (!token && tokenRequired) {
      throw new InvalidRequestError(
        'confirmation token required',
        'TokenRequired',
      )
    }

    if (token) {
      await this.assertValidEmailToken(did, 'update_email', token)
    }

    await this.updateAccountEmail({ did, email })

    account.email = email
    account.emailConfirmedAt = null

    // Proactively send a confirmation email so that the user can confirm the
    // new email immediately.
    if (opts?.sendConfirmationEmail) {
      const token = await this.createEmailToken(did, 'confirm_email')
      const locale = opts.locale
      await this.mailer.sendConfirmEmail({ token, locale }, { to: email })
    }

    return account
  }

  async updateAccountEmail(opts: { did: DidString; email: string }) {
    const { did, email } = opts
    await this.db.transaction(async (dbTxn) => {
      await accountHelpers.updateEmail(dbTxn, did, email)
      await emailToken.deleteAllEmailTokens(dbTxn, did)
    })
  }

  /**
   * @returns whether a row was actually updated. `false` means the account's
   * email no longer matched, or — when enabling — was no longer confirmed.
   */
  async updateAccountEmailAuthFactor(opts: {
    did: DidString
    email: string
    emailAuthFactor: boolean
  }): Promise<boolean> {
    const { did, email, emailAuthFactor } = opts
    const now = new Date()

    return accountHelpers.updateEmailAuthFactor(
      this.db,
      did,
      email,
      emailAuthFactor ? asDatetimeString(now.toISOString()) : null,
    )
  }

  /**
   * Enable email-based two-factor authentication. Enabling is immediate: the
   * account must already have a confirmed email matching `email`, since the
   * factor delivers one-time codes to that address. Returns
   * `{ account, tokenRequired }` for symmetry with future factors that require
   * a confirmation step; email-based 2FA never does, so `tokenRequired` is
   * always `false`.
   *
   * @throws InvalidRequestError if the account has no confirmed, matching email
   */
  async enableEmailAuthFactor(opts: {
    did: DidString
    email: string
  }): Promise<ActorAccount> {
    const { did, email } = opts

    const account = await this.getAccount(did, {
      includeDeactivated: true,
      includeTakenDown: true,
    })

    if (!account) {
      throw new InvalidRequestError('account not found')
    }

    if (
      !account.email ||
      account.email !== email ||
      !account.emailConfirmedAt
    ) {
      throw new InvalidRequestError(
        'A confirmed email address is required to enable email-based two-factor authentication',
      )
    }

    // Already enabled → nothing to change (idempotent).
    if (account.emailAuthFactorAt) {
      return account
    }

    const updated = await this.updateAccountEmailAuthFactor({
      did,
      email: account.email,
      emailAuthFactor: true,
    })

    // @NOTE The confirmed-email requirement is enforced in the UPDATE's WHERE
    // clause, not just by the check above, so a miss here means the address
    // stopped being confirmed (or changed) between that read and this write.
    // Nothing was persisted, so don't hand back an account claiming otherwise.
    if (!updated) {
      throw new InvalidRequestError(
        'A confirmed email address is required to enable email-based two-factor authentication',
      )
    }

    account.emailAuthFactorAt = asDatetimeString(new Date().toISOString())

    return account
  }

  /**
   * Disable email-based two-factor authentication. This supports a two-phase
   * flow, if a token isn't initially supplied for proving control of the inbox
   * which prevents a hijacked session from silently turning off the factor. The
   * second call (with a valid `token`) actually disables it. Disabling an
   * already-disabled factor is an idempotent no-op.
   *
   * @returns the (possibly updated) account together with `tokenRequired`:
   * `true` while an OTP is pending confirmation, `false` once the factor is
   * disabled or was already disabled
   * @throws InvalidRequestError if the account has no matching email, or the
   * token is invalid
   */
  async disableEmailAuthFactor(opts: {
    did: DidString
    email: string
    token?: string
    locale?: string
  }): Promise<{ account: ActorAccount | null; tokenRequired: boolean }> {
    const { did, email, token, locale } = opts

    const account = await this.getAccount(did, {
      includeDeactivated: true,
      includeTakenDown: true,
    })

    if (!account) {
      throw new InvalidRequestError('account not found')
    }

    if (!account.email || account.email !== email) {
      throw new InvalidRequestError('Email address does not match the account')
    }

    // Already disabled → idempotent no-op; nothing to confirm, no OTP sent.
    if (!account.emailAuthFactorAt) {
      return { account: null, tokenRequired: false }
    }

    // Phase one: no token yet, send a one-time code and signal "pending". MUST
    // use `update_email` due to social-app using requestEmailUpdate, not
    // two-step updateEmail:
    if (!token) {
      const otp = await this.createEmailToken(did, 'update_email')
      await this.mailer.sendUpdateEmail(
        { token: otp, locale: locale },
        { to: account.email },
      )
      return { account: account, tokenRequired: true }
    }

    // Phase two: verify the one-time code, then disable the factor.
    await this.assertValidEmailTokenAndCleanup(did, 'update_email', token)

    // The returned flag is deliberately ignored here, unlike in
    // `enableEmailAuthFactor`. Disabling only conditions the write on `did` and
    // `email` matching, so a miss means no row matched either, leaving nothing
    // worth reporting. A deleted account has no factor left to disable, and a
    // changed email clears `emailAuthFactorAt` in that same statement (see
    // `helpers/account.ts`). That second case stops arising once unconfirmed
    // emails get a column of their own, since `account.email` will no longer
    // move mid-flow; the conclusion holds either way.
    //
    // Enabling is the opposite: a miss there leaves the account in the very
    // state the caller asked to change, hence the throw.
    await this.updateAccountEmailAuthFactor({
      did,
      email: account.email,
      emailAuthFactor: false,
    })

    account.emailAuthFactorAt = null

    return { account, tokenRequired: false }
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

  async updateAccountPassword(opts: { did: DidString; password: string }) {
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
