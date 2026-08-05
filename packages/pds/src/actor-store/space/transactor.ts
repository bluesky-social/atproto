import { TID } from '@atproto/common'
import { cidForLex, encode } from '@atproto/lex-cbor'
import { Cid, TypedBlobRef, parseCid } from '@atproto/lex-data'
import { RepoCommit, SpaceRecord } from '@atproto/space'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { BlobTransactor } from '../blob/transactor.js'
import { ActorDb } from '../db/index.js'
import { SpaceReader } from './reader.js'

export type SpaceConfig = {
  policy?: string
  managingApp?: string | null
  appAccessType?: string
  appAllowed?: string[]
}

const MAX_WRITES_PER_COMMIT = 200

// `put` resolves to a create or update depending on what's stored.
type SpaceRecordWrite = {
  collection: string
  rkey: string
  record: SpaceRecord
  blobs?: TypedBlobRef[]
}

export type SpaceWrite =
  | ({ action: 'create' } & SpaceRecordWrite)
  | ({ action: 'update' } & SpaceRecordWrite)
  | ({ action: 'put' } & SpaceRecordWrite)
  | { action: 'delete'; collection: string; rkey: string }

export type SpaceWriteResult =
  | {
      action: 'create' | 'update'
      collection: string
      rkey: string
      cid: Cid
      prev: Cid | null
    }
  | {
      action: 'delete'
      collection: string
      rkey: string
      cid: null
      prev: Cid
    }

export type SpaceCommit = {
  rev: string
  setHash: Uint8Array
  results: SpaceWriteResult[]
}

export class SpaceRecordNotFoundError extends InvalidRequestError {
  constructor(collection: string, rkey: string) {
    super(`Record not found: ${collection}/${rkey}`, 'RecordNotFound')
  }
}

export class SpaceRecordAlreadyExistsError extends InvalidRequestError {
  constructor(collection: string, rkey: string) {
    super(`Record already exists: ${collection}/${rkey}`, 'RecordAlreadyExists')
  }
}

export class SpaceTransactor extends SpaceReader {
  constructor(
    public db: ActorDb,
    public blob: BlobTransactor,
  ) {
    super(db)
  }

  /**
   * A previously deleted space may be created again under the same uri. Its config
   * is reset to the new request's rather than revived, so a new space never inherits
   * the access rules of the deleted one.
   */
  async createSpace(
    uri: string,
    config: SpaceConfig = {},
    now?: string,
  ): Promise<void> {
    const timestamp = now ?? new Date().toISOString()
    const values = {
      policy: config.policy ?? 'member-list',
      managingApp: config.managingApp ?? null,
      appAccessType: config.appAccessType ?? 'open',
      appAllowed: JSON.stringify(config.appAllowed ?? []),
      createdAt: timestamp,
      deletedAt: null,
    }
    await this.db.db
      .insertInto('space')
      .values({ uri, ...values })
      .onConflict((oc) => oc.column('uri').doUpdateSet(values))
      .execute()
    await this.db.db
      .insertInto('space_repo')
      .values({ space: uri, setHash: null, rev: null })
      .onConflict((oc) => oc.column('space').doNothing())
      .execute()
  }

  // Lazily create the local space row + repo state for a writer's own repo on
  // first write. A writer's PDS isn't told about membership (the member list is
  // the authority's concern), so it materializes the repo when its user writes.
  async ensureSpaceRepo(uri: string, now?: string): Promise<void> {
    const existing = await this.getSpace(uri)
    if (existing?.deletedAt) {
      throw new InvalidRequestError('Space not found', 'SpaceNotFound')
    }
    if (existing) return
    await this.createSpace(uri, {}, now)
  }

  async addMember(space: string, did: string): Promise<void> {
    await this.db.db
      .insertInto('space_member')
      .values({ space, did })
      .onConflict((oc) => oc.columns(['space', 'did']).doNothing())
      .execute()
  }

  async removeMember(space: string, did: string): Promise<void> {
    await this.db.db
      .deleteFrom('space_member')
      .where('space', '=', space)
      .where('did', '=', did)
      .execute()
  }

  async updateSpaceConfig(uri: string, patch: SpaceConfig): Promise<void> {
    const set: Record<string, unknown> = {}
    if (patch.policy !== undefined) {
      set.policy = patch.policy
    }
    if (patch.managingApp !== undefined) {
      set.managingApp = patch.managingApp
    }
    if (patch.appAccessType !== undefined) {
      set.appAccessType = patch.appAccessType
    }
    if (patch.appAllowed !== undefined) {
      set.appAllowed = JSON.stringify(patch.appAllowed)
    }
    if (Object.keys(set).length === 0) return
    await this.db.db
      .updateTable('space')
      .set(set)
      .where('uri', '=', uri)
      .execute()
  }

  async markSpaceDeleted(uri: string, now?: string): Promise<void> {
    const timestamp = now ?? new Date().toISOString()
    await this.db.db
      .updateTable('space')
      .set({ deletedAt: timestamp })
      .where('uri', '=', uri)
      .execute()
  }

  /**
   * Cleanup after an authority deletes its own space: the authority-side state
   * (member list, writer set, credential recipients) and its own repo in the space.
   * The repo goes because the authority and the repo host are the same account here,
   * so there is no other party whose data this is.
   *
   * The `space` row itself is kept as a tombstone — see markSpaceDeleted.
   */
  async purgeSpaceData(uri: string): Promise<void> {
    const records = await this.db.db
      .selectFrom('space_record')
      .select(['collection', 'rkey'])
      .where('space', '=', uri)
      .execute()

    for (const table of [
      'space_member',
      'space_writer',
      'space_credential_recipient',
      'space_record',
      'space_record_oplog',
      'space_repo',
    ] as const) {
      await this.db.db.deleteFrom(table).where('space', '=', uri).execute()
    }

    // Drops the space_record_blob rows and any blob left unreferenced by them.
    await this.blob.deleteDereferencedSpaceBlobs(
      records.map((record) => ({
        space: uri,
        collection: record.collection,
        rkey: record.rkey,
      })),
      [],
    )
  }

  // Record (or advance) a writer in the space's writer set. Called by the
  // authority when it receives a notifyWrite. The writer set is what listRepos
  // enumerates as the sync boundary.
  async recordWriter(
    space: string,
    did: string,
    rev: string,
    hash: Uint8Array,
  ): Promise<void> {
    await this.db.db
      .insertInto('space_writer')
      .values({ space, did, rev, hash })
      .onConflict((oc) =>
        oc.columns(['space', 'did']).doUpdateSet({ rev, hash }),
      )
      .execute()
  }

  /**
   * One commit sharing a single `rev`. Writes resolve in order against the state the
   * batch has built up, not just what was stored on entry, so a batch can create then
   * update a record and a repeated create is caught rather than double-counted in the
   * set hash. Must run in a transaction.
   */
  async applyWrites(
    space: string,
    writes: SpaceWrite[],
    now?: string,
  ): Promise<SpaceCommit> {
    this.db.assertTransaction()
    if (writes.length > MAX_WRITES_PER_COMMIT) {
      throw new InvalidRequestError(
        `Too many writes. Max: ${MAX_WRITES_PER_COMMIT}`,
      )
    }

    await this.ensureSpaceRepo(space, now)

    const state = await this.getRepoState(space)
    const repo = RepoCommit.fromState(state?.setHash)
    const rev = TID.nextStr()
    const timestamp = now ?? new Date().toISOString()

    // Live cid per touched path, so later writes see earlier ones. null = deleted.
    const staged = new Map<string, Cid | null>()
    const pathKey = (collection: string, rkey: string) =>
      `${collection}/${rkey}`

    const results: SpaceWriteResult[] = []
    let idx = 0

    for (const write of writes) {
      const { collection, rkey } = write
      const key = pathKey(collection, rkey)
      const prev = staged.has(key)
        ? staged.get(key)!
        : await this.getRecordCid(space, collection, rkey)

      if (write.action === 'create' && prev) {
        throw new SpaceRecordAlreadyExistsError(collection, rkey)
      }
      if ((write.action === 'update' || write.action === 'delete') && !prev) {
        throw new SpaceRecordNotFoundError(collection, rkey)
      }

      if (write.action === 'delete') {
        const deleted = prev!
        await this.db.db
          .deleteFrom('space_record')
          .where('space', '=', space)
          .where('collection', '=', collection)
          .where('rkey', '=', rkey)
          .execute()
        repo.applyOp({ collection, rkey, cid: null, prev: deleted })
        staged.set(key, null)
        results.push({
          action: 'delete',
          collection,
          rkey,
          cid: null,
          prev: deleted,
        })
        await this.appendOplog(space, rev, idx++, {
          action: 'delete',
          collection,
          rkey,
          cid: null,
          prev: deleted,
        })
        continue
      }

      const cid = await cidForLex(write.record)
      const value = encode(write.record)
      await this.db.db
        .insertInto('space_record')
        .values({
          space,
          collection,
          rkey,
          cid: cid.toString(),
          value,
          repoRev: rev,
          indexedAt: timestamp,
        })
        .onConflict((oc) =>
          oc.columns(['space', 'collection', 'rkey']).doUpdateSet({
            cid: cid.toString(),
            value,
            repoRev: rev,
            indexedAt: timestamp,
          }),
        )
        .execute()

      repo.applyOp({ collection, rkey, cid, prev })
      staged.set(key, cid)
      const action = prev ? 'update' : 'create'
      results.push({ action, collection, rkey, cid, prev })
      await this.appendOplog(space, rev, idx++, {
        action,
        collection,
        rkey,
        cid,
        prev,
      })
    }

    const nextState = repo.setHash.state()
    await this.db.db
      .updateTable('space_repo')
      .set({ setHash: nextState, rev })
      .where('space', '=', space)
      .execute()

    await this.processBlobs(space, writes, results)

    return { rev, setHash: nextState, results }
  }

  // Until a blob is linked to a record it stays at its temp key, so getBlob would
  // find its metadata but none of its bytes.
  private async processBlobs(
    space: string,
    writes: SpaceWrite[],
    results: SpaceWriteResult[],
  ): Promise<void> {
    const touchedPaths = results.map((res) => ({
      space,
      collection: res.collection,
      rkey: res.rkey,
    }))
    const writtenBlobs: TypedBlobRef[] = []
    for (const write of writes) {
      if (write.action !== 'delete') {
        writtenBlobs.push(...(write.blobs ?? []))
      }
    }
    await this.blob.deleteDereferencedSpaceBlobs(touchedPaths, writtenBlobs)

    for (const write of writes) {
      if (write.action === 'delete') continue
      for (const blob of write.blobs ?? []) {
        await this.blob.associateSpaceBlob(blob, {
          space,
          collection: write.collection,
          rkey: write.rkey,
        })
        await this.blob.verifyBlobAndMakePermanent(blob)
      }
    }
  }

  private async getRecordCid(
    space: string,
    collection: string,
    rkey: string,
  ): Promise<Cid | null> {
    const row = await this.db.db
      .selectFrom('space_record')
      .select('cid')
      .where('space', '=', space)
      .where('collection', '=', collection)
      .where('rkey', '=', rkey)
      .executeTakeFirst()
    return row ? parseCid(row.cid) : null
  }

  private async appendOplog(
    space: string,
    rev: string,
    idx: number,
    op: {
      action: 'create' | 'update' | 'delete'
      collection: string
      rkey: string
      cid: Cid | null
      prev: Cid | null
    },
  ): Promise<void> {
    await this.db.db
      .insertInto('space_record_oplog')
      .values({
        space,
        rev,
        idx,
        action: op.action,
        collection: op.collection,
        rkey: op.rkey,
        cid: op.cid?.toString() ?? null,
        prev: op.prev?.toString() ?? null,
      })
      .execute()
  }

  async recordCredentialRecipient(
    space: string,
    serviceDid: string,
    serviceEndpoint: string,
  ): Promise<void> {
    const timestamp = new Date().toISOString()
    await this.db.db
      .insertInto('space_credential_recipient')
      .values({
        space,
        serviceDid,
        serviceEndpoint,
        lastIssuedAt: timestamp,
      })
      .onConflict((oc) =>
        oc.columns(['space', 'serviceDid']).doUpdateSet({
          serviceEndpoint,
          lastIssuedAt: timestamp,
        }),
      )
      .execute()
  }

  async removeCredentialRecipient(
    space: string,
    serviceDid: string,
  ): Promise<void> {
    await this.db.db
      .deleteFrom('space_credential_recipient')
      .where('space', '=', space)
      .where('serviceDid', '=', serviceDid)
      .execute()
  }
}
