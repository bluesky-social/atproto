import { AccountDb, AccountEntry, EmailTokenPurpose } from './db'
import * as scrypt from './helpers/scrypt'
import * as account from './helpers/account'
import * as repo from './helpers/repo'
import * as auth from './helpers/auth'
import * as invite from './helpers/invite'
import * as password from './helpers/password'
import * as emailToken from './helpers/email-token'
import { AuthScope } from '../auth-verifier'
import { HOUR } from '@atproto/common'
import { CID } from 'multiformats/cid'
import { StatusAttr } from '../lexicon/types/com/atproto/admin/defs'

export class AccountManager {
  db: AccountDb

  constructor(dbLocation: string, private jwtSecret: string) {}

  async close() {
    await this.db.close()
  }

  // Account Info

  async getAccount(
    handleOrDid: string,
    includeSoftDeleted = false,
  ): Promise<AccountEntry | null> {
    return account.getAccount(this.db, handleOrDid, includeSoftDeleted)
  }

  async getAccountByEmail(
    email: string,
    includeSoftDeleted = false,
  ): Promise<AccountEntry | null> {
    return account.getAccountByEmail(this.db, email, includeSoftDeleted)
  }

  // Repo exists and is not taken-down
  async isRepoAvailable(did: string) {
    const got = await this.getAccount(did)
    return !!got
  }

  async getDidForActor(
    handleOrDid: string,
    includeSoftDeleted = false,
  ): Promise<string | null> {
    const got = await this.getAccount(handleOrDid, includeSoftDeleted)
    return got?.did ?? null
  }

  async createAccount(opts: {
    did: string
    handle: string
    email: string
    password: string
    repoCid: CID
    repoRev: string
    inviteCode: string | undefined
  }) {
    const { did, handle, email, password, repoCid, repoRev, inviteCode } = opts
    const { access, refresh } = auth.createTokens({
      jwtSecret: this.jwtSecret,
      did,
      scope: AuthScope.Access,
    })
    const passwordScrypt = await scrypt.genSaltAndHash(password)
    const now = new Date().toISOString()
    await this.db.transaction((dbTxn) =>
      Promise.all([
        account.registerAccount(dbTxn, { did, handle, email, passwordScrypt }),
        repo.updateRoot(dbTxn, did, repoCid, repoRev),
        invite.recordInviteUse(dbTxn, {
          did,
          inviteCode,
          now,
        }),
        auth.storeRefreshToken(dbTxn, refresh.payload, null),
      ]),
    )
    return { access, refresh }
  }

  async updateRepoRoot(did: string, cid: CID, rev: string) {
    return repo.updateRoot(this.db, did, cid, rev)
  }

  async ensureInviteIsAvailable(code: string) {
    return invite.ensureInviteIsAvailable(this.db, code)
  }

  async createAppPassword(did: string, name: string) {
    return password.createAppPassword(this.db, did, name)
  }

  async listAppPasswords(did: string) {
    return password.listAppPasswords(this.db, did)
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
    disabled: 0 | 1,
  ) {
    return invite.createAccountInviteCodes(this.db, forAccount, codes, disabled)
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

  async createEmailToken(did: string, purpose: EmailTokenPurpose) {
    return emailToken.createEmailToken(this.db, did, purpose)
  }

  async setAccountInvitesDisabled(did: string, disabled: boolean) {
    return invite.setAccountInvitesDisabled(this.db, did, disabled)
  }

  async disableInviteCodes(opts: { codes: string[]; accounts: string[] }) {
    return invite.disableInviteCodes(this.db, opts)
  }

  async assertValidEmailToken(
    did: string,
    purpose: EmailTokenPurpose,
    token: string,
  ) {
    return emailToken.assertValidToken(this.db, did, purpose, token)
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

  async resetPassword(opts: { password: string; token: string }) {
    const did = await emailToken.assertValidTokenAndFindDid(
      this.db,
      'reset_password',
      opts.token,
    )
    const passwordScrypt = await scrypt.genSaltAndHash(opts.password)
    await this.db.transaction(async (dbTxn) =>
      Promise.all([
        password.updateUserPassword(dbTxn, { did, passwordScrypt }),
        emailToken.deleteEmailToken(dbTxn, did, 'reset_password'),
        auth.revokeRefreshTokensByDid(dbTxn, did),
      ]),
    )
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

  async verifyAccountPassword(did: string, password: string): Promise<boolean> {
    const found = await this.db.db
      .selectFrom('account')
      .selectAll()
      .where('did', '=', did)
      .executeTakeFirst()
    return found ? await scrypt.verify(password, found.passwordScrypt) : false
  }

  async verifyAppPassword(
    did: string,
    password: string,
  ): Promise<string | null> {
    const passwordScrypt = await scrypt.hashAppPassword(did, password)
    const found = await this.db.db
      .selectFrom('app_password')
      .selectAll()
      .where('did', '=', did)
      .where('passwordScrypt', '=', passwordScrypt)
      .executeTakeFirst()
    return found?.name ?? null
  }

  async revokeAppPassword(did: string, name: string) {
    await this.db.transaction(async (dbTxn) =>
      Promise.all([
        password.deleteAppPassword(dbTxn, did, name),
        auth.revokeAppPasswordRefreshToken(dbTxn, did, name),
      ]),
    )
  }

  // @NOTE should always be paired with a sequenceHandle().
  // the token output from this method should be passed to sequenceHandle().
  async updateHandle(did: string, handle: string) {
    return account.updateHandle(this.db, did, handle)
  }

  async updateEmail(opts: { did: string; email: string; token?: string }) {
    const { did, email, token } = opts
    if (token) {
      await this.db.transaction((dbTxn) =>
        Promise.all([
          account.updateEmail(dbTxn, did, email),
          emailToken.deleteEmailToken(dbTxn, did, 'update_email'),
        ]),
      )
    } else {
      return account.updateEmail(this.db, did, email)
    }
  }

  async createSession(did: string, appPasswordName: string | null) {
    const { access, refresh } = auth.createTokens({
      jwtSecret: this.jwtSecret,
      did,
      scope: appPasswordName === null ? AuthScope.Access : AuthScope.AppPass,
    })
    await auth.storeRefreshToken(this.db, refresh.payload, appPasswordName)
    return { access, refresh }
  }

  // @TODO tidy this one
  async rotateRefreshToken(id: string) {
    const token = await this.db.db
      .selectFrom('refresh_token')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()
    if (!token) return null

    return this.db.transaction(async (dbTxn) => {
      // take the chance to tidy all of a user's expired tokens
      const now = new Date()
      await dbTxn.db
        .deleteFrom('refresh_token')
        .where('did', '=', token.did)
        .where('expiresAt', '<=', now.toISOString())
        .returningAll()
        .executeTakeFirst()

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

      // Update token w/ possibly-updated expiration time
      // and next id, and tidy all of user's expired tokens.
      await dbTxn.db
        .updateTable('refresh_token')
        .where('id', '=', id)
        .set({ expiresAt: expiresAt.toISOString(), nextId })
        .executeTakeFirst()

      const { access, refresh } = auth.createTokens({
        jwtSecret: this.jwtSecret,
        did: token.did,

        scope:
          token.appPasswordName === null ? AuthScope.Access : AuthScope.AppPass,
        jti: nextId,
      })

      await auth.storeRefreshToken(
        dbTxn,
        refresh.payload,
        token.appPasswordName,
      )

      return { access, refresh }
    })
  }

  async revokeRefreshToken(id: string) {
    const { numDeletedRows } = await this.db.db
      .deleteFrom('refresh_token')
      .where('id', '=', id)
      .executeTakeFirst()
    return numDeletedRows > 0
  }
}
