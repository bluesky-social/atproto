import { sql } from 'kysely'
import { randomStr } from '@atproto/crypto'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { MINUTE, lessThanAgoMs } from '@atproto/common'
import { dbLogger as log } from '../../logger'
import Database from '../../db'
import * as scrypt from '../../db/scrypt'
import { UserAccountEntry } from '../../db/tables/user-account'
import { DidHandle } from '../../db/tables/did-handle'
import { RepoRoot } from '../../db/tables/repo-root'
import { countAll, notSoftDeletedClause } from '../../db/util'
import { paginate, TimeCidKeyset } from '../../db/pagination'
import * as sequencer from '../../sequencer'
import { AppPassword } from '../../lexicon/types/com/atproto/server/createAppPassword'
import { EmailTokenPurpose } from '../../db/tables/email-token'
import { getRandomToken } from '../../api/com/atproto/server/util'
import { AccountView } from '../../lexicon/types/com/atproto/admin/defs'
import { INVALID_HANDLE } from '@atproto/syntax'

export class AccountService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new AccountService(db)
  }

  async getAccount(
    handleOrDid: string,
    includeSoftDeleted = false,
  ): Promise<(UserAccountEntry & DidHandle & RepoRoot) | null> {
    const { ref } = this.db.db.dynamic
    const result = await this.db.db
      .selectFrom('user_account')
      .innerJoin('did_handle', 'did_handle.did', 'user_account.did')
      .innerJoin('repo_root', 'repo_root.did', 'did_handle.did')
      .if(!includeSoftDeleted, (qb) =>
        qb.where(notSoftDeletedClause(ref('repo_root'))),
      )
      .where((qb) => {
        if (handleOrDid.startsWith('did:')) {
          return qb.where('did_handle.did', '=', handleOrDid)
        } else {
          // lower() is a little hack to avoid using the handle trgm index here, which is slow. not sure why it was preferring
          // the handle trgm index over the handle unique index. in any case, we end-up using did_handle_handle_lower_idx instead, which is fast.
          return qb.where(
            sql`lower(${ref('did_handle.handle')})`,
            '=',
            handleOrDid,
          )
        }
      })
      .selectAll('user_account')
      .selectAll('did_handle')
      .selectAll('repo_root')
      .executeTakeFirst()
    return result || null
  }

  // Repo exists and is not taken-down
  async isRepoAvailable(did: string) {
    const found = await this.db.db
      .selectFrom('repo_root')
      .where('did', '=', did)
      .where('takedownRef', 'is', null)
      .select('did')
      .executeTakeFirst()
    return found !== undefined
  }

  async getAccountByEmail(
    email: string,
    includeSoftDeleted = false,
  ): Promise<(UserAccountEntry & DidHandle & RepoRoot) | null> {
    const { ref } = this.db.db.dynamic
    const found = await this.db.db
      .selectFrom('user_account')
      .innerJoin('did_handle', 'did_handle.did', 'user_account.did')
      .innerJoin('repo_root', 'repo_root.did', 'did_handle.did')
      .if(!includeSoftDeleted, (qb) =>
        qb.where(notSoftDeletedClause(ref('repo_root'))),
      )
      .where('email', '=', email.toLowerCase())
      .selectAll('user_account')
      .selectAll('did_handle')
      .selectAll('repo_root')
      .executeTakeFirst()
    return found || null
  }

  async getDidForActor(
    handleOrDid: string,
    includeSoftDeleted = false,
  ): Promise<string | null> {
    if (handleOrDid.startsWith('did:')) {
      if (includeSoftDeleted) {
        return handleOrDid
      }
      const available = await this.isRepoAvailable(handleOrDid)
      return available ? handleOrDid : null
    }
    const { ref } = this.db.db.dynamic
    const found = await this.db.db
      .selectFrom('did_handle')
      .innerJoin('repo_root', 'repo_root.did', 'did_handle.did')
      .if(!includeSoftDeleted, (qb) =>
        qb.where(notSoftDeletedClause(ref('repo_root'))),
      )
      .where('handle', '=', handleOrDid)
      .select('did_handle.did')
      .executeTakeFirst()
    return found ? found.did : null
  }

  async registerUser(opts: {
    email: string
    handle: string
    did: string
    passwordScrypt: string
  }) {
    this.db.assertTransaction()
    const { email, handle, did, passwordScrypt } = opts
    log.debug({ handle, email }, 'registering user')
    const registerUserAccnt = this.db.db
      .insertInto('user_account')
      .values({
        email: email.toLowerCase(),
        did,
        passwordScrypt,
        createdAt: new Date().toISOString(),
      })
      .onConflict((oc) => oc.doNothing())
      .returning('did')
      .executeTakeFirst()
    const registerDidHandle = this.db.db
      .insertInto('did_handle')
      .values({ did, handle })
      .onConflict((oc) => oc.doNothing())
      .returning('handle')
      .executeTakeFirst()

    const [res1, res2] = await Promise.all([
      registerUserAccnt,
      registerDidHandle,
    ])
    if (!res1 || !res2) {
      throw new UserAlreadyExistsError()
    }
    log.info({ handle, email, did }, 'registered user')
  }

  // @NOTE should always be paired with a sequenceHandle().
  // the token output from this method should be passed to sequenceHandle().
  async updateHandle(
    did: string,
    handle: string,
  ): Promise<HandleSequenceToken> {
    const res = await this.db.db
      .updateTable('did_handle')
      .set({ handle })
      .where('did', '=', did)
      .whereNotExists(
        // @NOTE see also condition in isHandleAvailable()
        this.db.db
          .selectFrom('did_handle')
          .where('handle', '=', handle)
          .selectAll(),
      )
      .executeTakeFirst()
    if (res.numUpdatedRows < 1) {
      throw new UserAlreadyExistsError()
    }
    return { did, handle }
  }

  async sequenceHandle(tok: HandleSequenceToken) {
    this.db.assertTransaction()
    const seqEvt = await sequencer.formatSeqHandleUpdate(tok.did, tok.handle)
    await sequencer.sequenceEvt(this.db, seqEvt)
  }

  async getHandleDid(handle: string): Promise<string | null> {
    // @NOTE see also condition in updateHandle()
    const found = await this.db.db
      .selectFrom('did_handle')
      .where('handle', '=', handle)
      .selectAll()
      .executeTakeFirst()
    return found?.did ?? null
  }

  async updateEmail(did: string, email: string) {
    await this.db.db
      .updateTable('user_account')
      .set({ email: email.toLowerCase(), emailConfirmedAt: null })
      .where('did', '=', did)
      .executeTakeFirst()
  }

  async updateUserPassword(did: string, password: string) {
    const passwordScrypt = await scrypt.genSaltAndHash(password)
    await this.db.db
      .updateTable('user_account')
      .set({ passwordScrypt })
      .where('did', '=', did)
      .execute()
  }

  async createAppPassword(did: string, name: string): Promise<AppPassword> {
    // create an app password with format:
    // 1234-abcd-5678-efgh
    const str = randomStr(16, 'base32').slice(0, 16)
    const chunks = [
      str.slice(0, 4),
      str.slice(4, 8),
      str.slice(8, 12),
      str.slice(12, 16),
    ]
    const password = chunks.join('-')
    const passwordScrypt = await scrypt.hashAppPassword(did, password)
    const got = await this.db.db
      .insertInto('app_password')
      .values({
        did,
        name,
        passwordScrypt,
        createdAt: new Date().toISOString(),
      })
      .returningAll()
      .executeTakeFirst()
    if (!got) {
      throw new InvalidRequestError('could not create app-specific password')
    }
    return {
      name,
      password,
      createdAt: got.createdAt,
    }
  }

  async deleteAppPassword(did: string, name: string) {
    await this.db.db
      .deleteFrom('app_password')
      .where('did', '=', did)
      .where('name', '=', name)
      .execute()
  }

  async verifyAccountPassword(did: string, password: string): Promise<boolean> {
    const found = await this.db.db
      .selectFrom('user_account')
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

  async listAppPasswords(
    did: string,
  ): Promise<{ name: string; createdAt: string }[]> {
    return this.db.db
      .selectFrom('app_password')
      .select(['name', 'createdAt'])
      .where('did', '=', did)
      .execute()
  }

  async search(opts: {
    query: string
    limit: number
    cursor?: string
    includeSoftDeleted?: boolean
  }): Promise<(RepoRoot & DidHandle)[]> {
    const { query, limit, cursor, includeSoftDeleted } = opts
    const { ref } = this.db.db.dynamic

    const builder = this.db.db
      .selectFrom('did_handle')
      .innerJoin('repo_root', 'repo_root.did', 'did_handle.did')
      .innerJoin('user_account', 'user_account.did', 'did_handle.did')
      .if(!includeSoftDeleted, (qb) =>
        qb.where(notSoftDeletedClause(ref('repo_root'))),
      )
      .where((qb) => {
        // sqlite doesn't support "ilike", but performs "like" case-insensitively
        const likeOp = this.db.dialect === 'pg' ? 'ilike' : 'like'
        if (query.includes('@')) {
          return qb.where('user_account.email', likeOp, `%${query}%`)
        }
        if (query.startsWith('did:')) {
          return qb.where('did_handle.did', '=', query)
        }
        return qb.where('did_handle.handle', likeOp, `${query}%`)
      })
      .selectAll(['did_handle', 'repo_root'])

    const keyset = new ListKeyset(
      ref('repo_root.indexedAt'),
      ref('did_handle.handle'),
    )

    return await paginate(builder, {
      limit,
      cursor,
      keyset,
    }).execute()
  }

  async list(opts: {
    limit: number
    cursor?: string
    includeSoftDeleted?: boolean
    invitedBy?: string
  }): Promise<(RepoRoot & DidHandle)[]> {
    const { limit, cursor, includeSoftDeleted, invitedBy } = opts
    const { ref } = this.db.db.dynamic

    let builder = this.db.db
      .selectFrom('repo_root')
      .innerJoin('did_handle', 'did_handle.did', 'repo_root.did')
      .if(!includeSoftDeleted, (qb) =>
        qb.where(notSoftDeletedClause(ref('repo_root'))),
      )
      .selectAll('did_handle')
      .selectAll('repo_root')

    if (invitedBy) {
      builder = builder
        .innerJoin(
          'invite_code_use as code_use',
          'code_use.usedBy',
          'did_handle.did',
        )
        .innerJoin('invite_code', 'invite_code.code', 'code_use.code')
        .where('invite_code.forUser', '=', invitedBy)
    }

    const keyset = new ListKeyset(ref('indexedAt'), ref('handle'))

    return await paginate(builder, {
      limit,
      cursor,
      keyset,
    }).execute()
  }

  async deleteAccount(did: string): Promise<void> {
    // Not done in transaction because it would be too long, prone to contention.
    // Also, this can safely be run multiple times if it fails.
    await this.db.db
      .deleteFrom('refresh_token')
      .where('did', '=', did)
      .execute()
    await this.db.db
      .deleteFrom('user_account')
      .where('user_account.did', '=', did)
      .execute()
    await this.db.db
      .deleteFrom('did_handle')
      .where('did_handle.did', '=', did)
      .execute()
    const seqEvt = await sequencer.formatSeqTombstone(did)
    await this.db.transaction(async (txn) => {
      await sequencer.sequenceEvt(txn, seqEvt)
    })
  }

  async adminView(did: string): Promise<AccountView | null> {
    const accountQb = this.db.db
      .selectFrom('did_handle')
      .innerJoin('user_account', 'user_account.did', 'did_handle.did')
      .where('did_handle.did', '=', did)
      .select([
        'did_handle.did',
        'did_handle.handle',
        'user_account.email',
        'user_account.emailConfirmedAt',
        'user_account.invitesDisabled',
        'user_account.inviteNote',
        'user_account.createdAt as indexedAt',
      ])

    const [account, invites, invitedBy] = await Promise.all([
      accountQb.executeTakeFirst(),
      this.getAccountInviteCodes(did),
      this.getInvitedByForAccounts([did]),
    ])

    if (!account) return null

    return {
      ...account,
      handle: account?.handle ?? INVALID_HANDLE,
      invitesDisabled: account.invitesDisabled === 1,
      inviteNote: account.inviteNote ?? undefined,
      emailConfirmedAt: account.emailConfirmedAt ?? undefined,
      invites,
      invitedBy: invitedBy[did],
    }
  }

  selectInviteCodesQb() {
    const ref = this.db.db.dynamic.ref
    const builder = this.db.db
      .selectFrom('invite_code')
      .select([
        'invite_code.code as code',
        'invite_code.availableUses as available',
        'invite_code.disabled as disabled',
        'invite_code.forUser as forAccount',
        'invite_code.createdBy as createdBy',
        'invite_code.createdAt as createdAt',
        this.db.db
          .selectFrom('invite_code_use')
          .select(countAll.as('count'))
          .whereRef('invite_code_use.code', '=', ref('invite_code.code'))
          .as('uses'),
      ])
    return this.db.db.selectFrom(builder.as('codes')).selectAll()
  }

  async getInviteCodesUses(
    codes: string[],
  ): Promise<Record<string, CodeUse[]>> {
    const uses: Record<string, CodeUse[]> = {}
    if (codes.length > 0) {
      const usesRes = await this.db.db
        .selectFrom('invite_code_use')
        .where('code', 'in', codes)
        .selectAll()
        .execute()
      for (const use of usesRes) {
        const { code, usedBy, usedAt } = use
        uses[code] ??= []
        uses[code].push({ usedBy, usedAt })
      }
    }
    return uses
  }

  async getAccountInviteCodes(did: string): Promise<CodeDetail[]> {
    const res = await this.selectInviteCodesQb()
      .where('forAccount', '=', did)
      .execute()
    const codes = res.map((row) => row.code)
    const uses = await this.getInviteCodesUses(codes)
    return res.map((row) => ({
      ...row,
      uses: uses[row.code] ?? [],
      disabled: row.disabled === 1,
    }))
  }

  async getInvitedByForAccounts(
    dids: string[],
  ): Promise<Record<string, CodeDetail>> {
    if (dids.length < 1) return {}
    const codeDetailsRes = await this.selectInviteCodesQb()
      .where('code', 'in', (qb) =>
        qb
          .selectFrom('invite_code_use')
          .where('usedBy', 'in', dids)
          .select('code')
          .distinct(),
      )
      .execute()
    const uses = await this.getInviteCodesUses(
      codeDetailsRes.map((row) => row.code),
    )
    const codeDetails = codeDetailsRes.map((row) => ({
      ...row,
      uses: uses[row.code] ?? [],
      disabled: row.disabled === 1,
    }))
    return codeDetails.reduce((acc, cur) => {
      for (const use of cur.uses) {
        acc[use.usedBy] = cur
      }
      return acc
    }, {} as Record<string, CodeDetail>)
  }

  async createEmailToken(
    did: string,
    purpose: EmailTokenPurpose,
  ): Promise<string> {
    const token = getRandomToken().toUpperCase()
    await this.db.db
      .insertInto('email_token')
      .values({ purpose, did, token, requestedAt: new Date() })
      .onConflict((oc) =>
        oc
          .columns(['purpose', 'did'])
          .doUpdateSet({ token, requestedAt: new Date() }),
      )
      .execute()
    return token
  }

  async deleteEmailToken(did: string, purpose: EmailTokenPurpose) {
    await this.db.db
      .deleteFrom('email_token')
      .where('did', '=', did)
      .where('purpose', '=', purpose)
      .executeTakeFirst()
  }

  async assertValidToken(
    did: string,
    purpose: EmailTokenPurpose,
    token: string,
    expirationLen = 15 * MINUTE,
  ) {
    const res = await this.db.db
      .selectFrom('email_token')
      .selectAll()
      .where('purpose', '=', purpose)
      .where('did', '=', did)
      .where('token', '=', token.toUpperCase())
      .executeTakeFirst()
    if (!res) {
      throw new InvalidRequestError('Token is invalid', 'InvalidToken')
    }
    const expired = !lessThanAgoMs(res.requestedAt, expirationLen)
    if (expired) {
      throw new InvalidRequestError('Token is expired', 'ExpiredToken')
    }
  }

  async assertValidTokenAndFindDid(
    purpose: EmailTokenPurpose,
    token: string,
    expirationLen = 15 * MINUTE,
  ): Promise<string> {
    const res = await this.db.db
      .selectFrom('email_token')
      .selectAll()
      .where('purpose', '=', purpose)
      .where('token', '=', token.toUpperCase())
      .executeTakeFirst()
    if (!res) {
      throw new InvalidRequestError('Token is invalid', 'InvalidToken')
    }
    const expired = !lessThanAgoMs(res.requestedAt, expirationLen)
    if (expired) {
      throw new InvalidRequestError('Token is expired', 'ExpiredToken')
    }
    return res.did
  }

  async getPreferences(
    did: string,
    namespace?: string,
  ): Promise<UserPreference[]> {
    const prefsRes = await this.db.db
      .selectFrom('user_pref')
      .where('did', '=', did)
      .orderBy('id')
      .selectAll()
      .execute()
    return prefsRes
      .filter((pref) => !namespace || matchNamespace(namespace, pref.name))
      .map((pref) => JSON.parse(pref.valueJson))
  }

  async putPreferences(
    did: string,
    values: UserPreference[],
    namespace: string,
  ): Promise<void> {
    this.db.assertTransaction()
    if (!values.every((value) => matchNamespace(namespace, value.$type))) {
      throw new InvalidRequestError(
        `Some preferences are not in the ${namespace} namespace`,
      )
    }
    // short-held row lock to prevent races
    if (this.db.dialect === 'pg') {
      await this.db.db
        .selectFrom('user_account')
        .selectAll()
        .forUpdate()
        .where('did', '=', did)
        .executeTakeFirst()
    }
    // get all current prefs for user and prep new pref rows
    const allPrefs = await this.db.db
      .selectFrom('user_pref')
      .where('did', '=', did)
      .select(['id', 'name'])
      .execute()
    const putPrefs = values.map((value) => {
      return {
        did,
        name: value.$type,
        valueJson: JSON.stringify(value),
      }
    })
    const allPrefIdsInNamespace = allPrefs
      .filter((pref) => matchNamespace(namespace, pref.name))
      .map((pref) => pref.id)
    // replace all prefs in given namespace
    if (allPrefIdsInNamespace.length) {
      await this.db.db
        .deleteFrom('user_pref')
        .where('did', '=', did)
        .where('id', 'in', allPrefIdsInNamespace)
        .execute()
    }
    if (putPrefs.length) {
      await this.db.db.insertInto('user_pref').values(putPrefs).execute()
    }
  }
}

export type UserPreference = Record<string, unknown> & { $type: string }

export type CodeDetail = {
  code: string
  available: number
  disabled: boolean
  forAccount: string
  createdBy: string
  createdAt: string
  uses: CodeUse[]
}

type CodeUse = {
  usedBy: string
  usedAt: string
}

export class UserAlreadyExistsError extends Error {}

export class ListKeyset extends TimeCidKeyset<{
  indexedAt: string
  handle: string // handles are treated identically to cids in TimeCidKeyset
}> {
  labelResult(result: { indexedAt: string; handle: string }) {
    return { primary: result.indexedAt, secondary: result.handle }
  }
}

const matchNamespace = (namespace: string, fullname: string) => {
  return fullname === namespace || fullname.startsWith(`${namespace}.`)
}

export type HandleSequenceToken = { did: string; handle: string }
