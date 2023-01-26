import { sql } from 'kysely'
import * as common from '@atproto/common'
import { dbLogger as log } from '../logger'
import Database from '../db'
import * as scrypt from '../db/scrypt'
import { User } from '../db/tables/user'
import { DidHandle } from '../db/tables/did-handle'
import { RepoRoot } from '../db/tables/repo-root'
import { Record as DeclarationRecord } from '../lexicon/types/app/bsky/system/declaration'
import { APP_BSKY_GRAPH } from '../lexicon'
import { notSoftDeletedClause } from '../db/util'
import { getUserSearchQueryPg, getUserSearchQuerySqlite } from './util/search'
import { paginate, TimeCidKeyset } from '../db/pagination'

export class ActorService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new ActorService(db)
  }

  async getUser(
    handleOrDid: string,
    includeSoftDeleted = false,
  ): Promise<(User & DidHandle & RepoRoot) | null> {
    const { ref } = this.db.db.dynamic
    let query = this.db.db
      .selectFrom('user')
      .innerJoin('did_handle', 'did_handle.handle', 'user.handle')
      .innerJoin('repo_root', 'repo_root.did', 'did_handle.did')
      .if(!includeSoftDeleted, (qb) =>
        qb.where(notSoftDeletedClause(ref('repo_root'))),
      )
      .selectAll('user')
      .selectAll('did_handle')
      .selectAll('repo_root')
    if (handleOrDid.startsWith('did:')) {
      query = query.where('did_handle.did', '=', handleOrDid)
    } else {
      query = query.where('did_handle.handle', '=', handleOrDid.toLowerCase())
    }
    const found = await query.executeTakeFirst()
    return found || null
  }

  async getUserByEmail(
    email: string,
    includeSoftDeleted = false,
  ): Promise<(User & DidHandle & RepoRoot) | null> {
    const { ref } = this.db.db.dynamic
    const found = await this.db.db
      .selectFrom('user')
      .innerJoin('did_handle', 'did_handle.handle', 'user.handle')
      .innerJoin('repo_root', 'repo_root.did', 'did_handle.did')
      .if(!includeSoftDeleted, (qb) =>
        qb.where(notSoftDeletedClause(ref('repo_root'))),
      )
      .where('email', '=', email.toLowerCase())
      .selectAll('user')
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

  async registerUser(email: string, handle: string, password: string) {
    this.db.assertTransaction()
    log.debug({ handle, email }, 'registering user')
    const inserted = await this.db.db
      .insertInto('user')
      .values({
        email: email.toLowerCase(),
        handle: handle,
        password: await scrypt.hash(password),
        createdAt: new Date().toISOString(),
        lastSeenNotifs: new Date().toISOString(),
      })
      .onConflict((oc) => oc.doNothing())
      .returning('handle')
      .executeTakeFirst()
    if (!inserted) {
      throw new UserAlreadyExistsError()
    }
    log.info({ handle, email }, 'registered user')
  }

  async preregisterDid(handle: string, tempDid: string) {
    this.db.assertTransaction()
    const inserted = await this.db.db
      .insertInto('did_handle')
      .values({
        handle,
        did: tempDid,
        actorType: 'temp',
        declarationCid: 'temp',
      })
      .onConflict((oc) => oc.doNothing())
      .returning('handle')
      .executeTakeFirst()
    if (!inserted) {
      throw new UserAlreadyExistsError()
    }
    log.info({ handle, tempDid }, 'pre-registered did')
  }

  async finalizeDid(
    handle: string,
    did: string,
    tempDid: string,
    declaration: DeclarationRecord,
  ) {
    this.db.assertTransaction()
    log.debug({ handle, did }, 'registering did-handle')
    const declarationCid = await common.cidForData(declaration)
    const updated = await this.db.db
      .updateTable('did_handle')
      .set({
        did,
        actorType: declaration.actorType,
        declarationCid: declarationCid.toString(),
      })
      .where('handle', '=', handle)
      .where('did', '=', tempDid)
      .returningAll()
      .executeTakeFirst()
    if (!updated) {
      throw new Error('DID could not be finalized')
    }
    log.info({ handle, did }, 'post-registered did-handle')
  }

  async updateUserPassword(handle: string, password: string) {
    const hashedPassword = await scrypt.hash(password)
    await this.db.db
      .updateTable('user')
      .set({ password: hashedPassword })
      .where('handle', '=', handle)
      .execute()
  }

  async verifyUserPassword(handle: string, password: string): Promise<boolean> {
    const found = await this.db.db
      .selectFrom('user')
      .selectAll()
      .where('handle', '=', handle)
      .executeTakeFirst()
    if (!found) return false
    return scrypt.verify(password, found.password)
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
    before?: string
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
    before?: string
    includeSoftDeleted?: boolean
  }): Promise<(RepoRoot & DidHandle)[]> {
    const { limit, before, includeSoftDeleted } = opts
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
      before,
      keyset,
    }).execute()
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
