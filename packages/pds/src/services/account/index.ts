import { sql } from 'kysely'
import { dbLogger as log } from '../../logger'
import Database from '../../db'
import * as scrypt from '../../db/scrypt'
import { UserAccount } from '../../db/tables/user-account'
import { DidHandle } from '../../db/tables/did-handle'
import { RepoRoot } from '../../db/tables/repo-root'
import { notSoftDeletedClause } from '../../db/util'
import { getUserSearchQueryPg, getUserSearchQuerySqlite } from '../util/search'
import { paginate, TimeCidKeyset } from '../../db/pagination'
import { sequenceHandleUpdate } from '../../sequencer'

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

  async registerUser(
    email: string,
    handle: string,
    did: string,
    password: string,
  ) {
    this.db.assertTransaction()
    log.debug({ handle, email }, 'registering user')
    const registerUserAccnt = this.db.db
      .insertInto('user_account')
      .values({
        email: email.toLowerCase(),
        did,
        passwordScrypt: await scrypt.hash(password),
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

  async updateUserPassword(did: string, password: string) {
    const passwordScrypt = await scrypt.hash(password)
    await this.db.db
      .updateTable('user_account')
      .set({ passwordScrypt })
      .where('did', '=', did)
      .execute()
  }

  async verifyUserPassword(did: string, password: string): Promise<boolean> {
    const found = await this.db.db
      .selectFrom('user_account')
      .selectAll()
      .where('did', '=', did)
      .executeTakeFirst()
    if (!found) return false
    return scrypt.verify(password, found.passwordScrypt)
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
  }): Promise<(RepoRoot & DidHandle)[]> {
    const { limit, cursor, includeSoftDeleted } = opts
    const { ref } = this.db.db.dynamic

    const builder = this.db.db
      .selectFrom('repo_root')
      .innerJoin('did_handle', 'did_handle.did', 'repo_root.did')
      .if(!includeSoftDeleted, (qb) =>
        qb.where(notSoftDeletedClause(ref('repo_root'))),
      )
      .selectAll('did_handle')
      .selectAll('repo_root')

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
