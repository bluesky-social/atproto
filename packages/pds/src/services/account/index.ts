import { sql } from 'kysely'
import { dbLogger as log } from '../../logger'
import Database from '../../db'
import * as scrypt from '../../db/scrypt'
import { UserAccount } from '../../db/tables/user-account'
import { DidHandle } from '../../db/tables/did-handle'
import { RepoRoot } from '../../db/tables/repo-root'
import { countAll, notSoftDeletedClause, nullToZero } from '../../db/util'
import { getUserSearchQueryPg, getUserSearchQuerySqlite } from '../util/search'
import { paginate, TimeCidKeyset } from '../../db/pagination'
import { sequenceHandleUpdate } from '../../sequencer'
import { AppPassword } from '../../lexicon/types/com/atproto/server/createAppPassword'
import { randomStr } from '@atproto/crypto'
import { InvalidRequestError } from '@atproto/xrpc-server'

export class AccountService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new AccountService(db)
  }

  async getAccount(
    handleOrDid: string,
    includeSoftDeleted = false,
  ): Promise<(UserAccount & DidHandle & RepoRoot) | null> {
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
          return qb.where('did_handle.handle', '=', handleOrDid)
        }
      })
      .selectAll('user_account')
      .selectAll('did_handle')
      .selectAll('repo_root')
      .executeTakeFirst()
    return result || null
  }

  async getAccountByEmail(
    email: string,
    includeSoftDeleted = false,
  ): Promise<(UserAccount & DidHandle & RepoRoot) | null> {
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
    if (handleOrDid.startsWith('did:')) return handleOrDid
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
    const registerUserState = this.db.db
      .insertInto('user_state')
      .values({
        did,
        lastSeenNotifs: new Date().toISOString(),
      })
      .onConflict((oc) => oc.doNothing())
      .returning('did')
      .executeTakeFirst()

    const [res1, res2, res3] = await Promise.all([
      registerUserAccnt,
      registerDidHandle,
      registerUserState,
    ])
    if (!res1 || !res2 || !res3) {
      throw new UserAlreadyExistsError()
    }
    log.info({ handle, email, did }, 'registered user')
  }

  async updateHandle(did: string, handle: string) {
    const res = await this.db.db
      .updateTable('did_handle')
      .set({ handle })
      .where('did', '=', did)
      .whereNotExists(
        this.db.db
          .selectFrom('did_handle')
          .where('handle', '=', handle)
          .selectAll(),
      )
      .executeTakeFirst()
    if (res.numUpdatedRows < 1) {
      throw new UserAlreadyExistsError()
    }
    await sequenceHandleUpdate(this.db, did, handle)
  }

  async updateEmail(did: string, email: string) {
    await this.db.db
      .updateTable('user_account')
      .set({ email: email.toLowerCase() })
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

  async mute(info: { did: string; mutedByDid: string; createdAt?: Date }) {
    const { did, mutedByDid, createdAt = new Date() } = info
    await this.db.db
      .insertInto('mute')
      .values({
        did,
        mutedByDid,
        createdAt: createdAt.toISOString(),
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
  }

  async unmute(info: { did: string; mutedByDid: string }) {
    const { did, mutedByDid } = info
    await this.db.db
      .deleteFrom('mute')
      .where('did', '=', did)
      .where('mutedByDid', '=', mutedByDid)
      .execute()
  }

  async search(opts: {
    term: string
    limit: number
    cursor?: string
    includeSoftDeleted?: boolean
  }): Promise<(RepoRoot & DidHandle & { distance: number })[]> {
    const builder =
      this.db.dialect === 'pg'
        ? getUserSearchQueryPg(this.db, opts)
            .innerJoin('repo_root', 'repo_root.did', 'did_handle.did')
            .selectAll('did_handle')
            .selectAll('repo_root')
            .select('results.distance as distance')
        : getUserSearchQuerySqlite(this.db, opts)
            .leftJoin('profile', 'profile.creator', 'did_handle.did') // @TODO leaky, for getUserSearchQuerySqlite()
            .innerJoin('repo_root', 'repo_root.did', 'did_handle.did')
            .selectAll('did_handle')
            .selectAll('repo_root')
            .select(sql<number>`0`.as('distance'))
    return await builder.execute()
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
    this.db.assertTransaction()
    await Promise.all([
      this.db.db.deleteFrom('refresh_token').where('did', '=', did).execute(),
      this.db.db
        .deleteFrom('user_account')
        .where('user_account.did', '=', did)
        .execute(),
      this.db.db
        .deleteFrom('did_handle')
        .where('did_handle.did', '=', did)
        .execute(),
    ])
  }

  selectInviteCodesQb() {
    const ref = this.db.db.dynamic.ref
    const builder = this.db.db
      .with('use_count', (qb) =>
        qb
          .selectFrom('invite_code_use')
          .groupBy('code')
          .select(['code', countAll.as('uses')]),
      )
      .selectFrom('invite_code')
      .leftJoin('use_count', 'invite_code.code', 'use_count.code')
      .select([
        'invite_code.code as code',
        'invite_code.availableUses as available',
        'invite_code.disabled as disabled',
        'invite_code.forUser as forAccount',
        'invite_code.createdBy as createdBy',
        'invite_code.createdAt as createdAt',
        nullToZero(ref('use_count.uses')).as('uses'),
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

  async getAccountInviteCodes(did: string) {
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
}

type CodeDetail = {
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
