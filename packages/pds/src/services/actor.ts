import * as common from '@atproto/common'
import { dbLogger as log } from '../logger'
import Database from '../db'
import * as scrypt from '../db/scrypt'
import { User } from '../db/tables/user'
import { DidHandle } from '../db/tables/did-handle'
import { Record as DeclarationRecord } from '../lexicon/types/app/bsky/system/declaration'
import { APP_BSKY_GRAPH } from '../lexicon'

export class ActorService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new ActorService(db)
  }

  async getUser(handleOrDid: string): Promise<(User & DidHandle) | null> {
    let query = this.db.db
      .selectFrom('user')
      .innerJoin('did_handle', 'did_handle.handle', 'user.handle')
      .selectAll()
    if (handleOrDid.startsWith('did:')) {
      query = query.where('did', '=', handleOrDid)
    } else {
      query = query.where('did_handle.handle', '=', handleOrDid.toLowerCase())
    }
    const found = await query.executeTakeFirst()
    return found || null
  }

  async getUserByEmail(email: string): Promise<(User & DidHandle) | null> {
    const found = await this.db.db
      .selectFrom('user')
      .innerJoin('did_handle', 'did_handle.handle', 'user.handle')
      .selectAll()
      .where('email', '=', email.toLowerCase())
      .executeTakeFirst()
    return found || null
  }

  async getDidForActor(handleOrDid: string): Promise<string | null> {
    if (handleOrDid.startsWith('did:')) return handleOrDid
    const found = await this.db.db
      .selectFrom('did_handle')
      .where('handle', '=', handleOrDid)
      .select('did')
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

  async getScenesForUser(userDid: string): Promise<string[]> {
    const res = await this.db.db
      .selectFrom('assertion')
      .where('assertion.subjectDid', '=', userDid)
      .where('assertion.assertion', '=', APP_BSKY_GRAPH.AssertMember)
      .where('assertion.confirmUri', 'is not', null)
      .select('assertion.creator as scene')
      .execute()
    return res.map((row) => row.scene)
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
}

export class UserAlreadyExistsError extends Error {}
