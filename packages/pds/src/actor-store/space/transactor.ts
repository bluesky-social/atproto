import { TID } from '@atproto/common'
import { encode } from '@atproto/lex-cbor'
import { Cid, parseCid } from '@atproto/lex-data'
import { WriteOpAction, formatDataKey } from '@atproto/repo'
import { RepoCommit } from '@atproto/space'
import { SpaceRef, SpaceRefString } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { BadRecordSwapError, PreparedWrite } from '../../repo/types.js'
import { BlobTransactor } from '../blob/transactor.js'
import { ActorDb, SpaceRecordOplog } from '../db/index.js'
import { SpaceAppAccess, SpacePolicy, SpaceReader } from './reader.js'

export class SpaceTransactor extends SpaceReader {
  constructor(
    public db: ActorDb,
    public blob: BlobTransactor,
  ) {
    super(db)
  }

  /**
   * Record that this account holds a repo in a space, whoever governs it. Creating a
   * space under this account's own authority also writes its config — see createSpace.
   */
  async ensureSpace(uri: string): Promise<void> {
    const { spaceDid, spaceType } = SpaceRef.parse(uri)
    const values = {
      authority: spaceDid,
      type: spaceType,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    }
    await this.db.db
      .insertInto('space')
      .values({ uri, ...values })
      .onConflict((oc) => oc.column('uri').doUpdateSet(values))
      .execute()
    await this.ensureRepoState(uri)
  }

  /**
   * Create a space this account is the authority for.
   *
   * A previously deleted space may be created again under the same uri. Its config is
   * reset to the new request's rather than revived, so a new space never inherits the
   * access rules of the deleted one.
   */
  async createSpace(
    uri: string,
    policy: SpacePolicy,
    appAccess: SpaceAppAccess,
  ): Promise<void> {
    await this.ensureSpace(uri)
    const config = {
      ...policy,
      ...appAccess,
    }
    await this.db.db
      .insertInto('simplespace_config')
      .values({ uri, ...config })
      .onConflict((oc) => oc.column('uri').doUpdateSet(config))
      .execute()
  }

  // deleteSpace drops this row, so a space coming back needs it restored — without
  // clobbering the state of one that's still live.
  private async ensureRepoState(uri: string): Promise<void> {
    await this.db.db
      .insertInto('space_repo')
      .values({ space: uri, setHash: null, rev: null })
      .onConflict((oc) => oc.column('space').doNothing())
      .execute()
  }

  /**
   * Lazily create the local space row + repo state for a writer's own repo on first
   * write. A writer's PDS isn't told about membership (the member list is the
   * authority's concern), so it materializes the repo when its user writes.
   *
   * Writing to a space marked deleted clears the mark: an authority may recreate a
   * space under the same uri, and the write is the fresher signal.
   */
  async ensureSpaceRepo(uri: string): Promise<void> {
    const existing = await this.getSpace(uri)
    if (existing && !existing.deletedAt) return
    if (existing) {
      await this.db.db
        .updateTable('space')
        .set({ deletedAt: null })
        .where('uri', '=', uri)
        .execute()
      await this.ensureRepoState(uri)
      return
    }
    await this.ensureSpace(uri)
  }

  async addMember(space: string, did: string): Promise<void> {
    await this.db.db
      .insertInto('simplespace_member')
      .values({ space, did })
      .onConflict((oc) => oc.columns(['space', 'did']).doNothing())
      .execute()
  }

  async removeMember(space: string, did: string): Promise<void> {
    await this.db.db
      .deleteFrom('simplespace_member')
      .where('space', '=', space)
      .where('did', '=', did)
      .execute()
  }

  // Patch: a policy or appAccess left out keeps its current value.
  async updateSpaceConfig(
    uri: string,
    patch: { policy?: SpacePolicy; appAccess?: SpaceAppAccess },
  ): Promise<void> {
    if (patch.policy) {
      await this.db.db
        .updateTable('simplespace_config')
        .set(patch.policy)
        .where('uri', '=', uri)
        .execute()
    }
    if (patch.appAccess) {
      await this.db.db
        .updateTable('simplespace_config')
        .set(patch.appAccess)
        .where('uri', '=', uri)
        .execute()
    }
  }

  // Flag a space as deleted without dropping anything, for a member whose authority
  // deleted a space out from under them. The records are the member's own.
  async markSpaceDeleted(uri: string): Promise<void> {
    await this.db.db
      .updateTable('space')
      .set({ deletedAt: new Date().toISOString() })
      .where('uri', '=', uri)
      .execute()
  }

  /**
   * Delete a space this account is the authority for, including its own repo in the
   * space — the authority and the repo host are the same account here, so there's no
   * other party whose data this is.
   *
   * The `space` row survives as a tombstone, so getSpace and getSpaceCredential can
   * keep reporting the space as deleted.
   */
  async deleteSpace(uri: string): Promise<void> {
    await this.markSpaceDeleted(uri)
    await this.db.db
      .deleteFrom('simplespace_config')
      .where('uri', '=', uri)
      .execute()
    await this.db.db
      .deleteFrom('simplespace_member')
      .where('space', '=', uri)
      .execute()
    await this.db.db
      .deleteFrom('space_writer')
      .where('space', '=', uri)
      .execute()
    await this.db.db
      .deleteFrom('space_credential_recipient')
      .where('space', '=', uri)
      .execute()
    await this.db.db
      .deleteFrom('space_record')
      .where('space', '=', uri)
      .execute()
    await this.db.db
      .deleteFrom('space_record_oplog')
      .where('space', '=', uri)
      .execute()
    await this.db.db.deleteFrom('space_repo').where('space', '=', uri).execute()
    await this.blob.deleteSpaceBlobs(uri)
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
   * Apply a batch of writes as one commit, all sharing a single `rev`. Must run in a
   * transaction.
   *
   * Each write resolves against the state the batch has built up so far rather than
   * what was stored on entry, so a batch can create a record and then update it, and a
   * repeated create is rejected instead of being counted into the set hash twice.
   *
   * Returns null if there was nothing to write.
   */
  async applyWrites(
    space: SpaceRefString,
    writes: PreparedWrite[],
  ): Promise<{ rev: string; setHash: Uint8Array } | null> {
    this.db.assertTransaction()
    if (writes.length === 0) return null

    await this.ensureSpaceRepo(space)

    const state = await this.getRepoState(space)
    const repo = RepoCommit.fromState(state?.setHash)
    const rev = TID.nextStr()

    // The live cid at each path this batch has touched, so far. null once deleted.
    const staged = new Map<string, Cid | null>()
    const ops: SpaceRecordOplog[] = []

    for (const write of writes) {
      const { collection, rkey } = write.uri
      const path = formatDataKey(collection, rkey)
      const prev = staged.has(path)
        ? staged.get(path) ?? null
        : await this.getRecordCid(space, collection, rkey)

      // No space lexicon offers a swap yet, so this only fires if one starts to — better
      // than accepting a compare-and-swap and not performing it.
      if (write.swapCid && (!prev || !write.swapCid.equals(prev))) {
        throw new BadRecordSwapError(prev)
      }

      let cid: Cid | null = null
      if (write.action === WriteOpAction.Delete) {
        if (!prev) throw new SpaceRecordNotFoundError(collection, rkey)
        await this.db.db
          .deleteFrom('space_record')
          .where('space', '=', space)
          .where('collection', '=', collection)
          .where('rkey', '=', rkey)
          .execute()
      } else {
        if (write.action === WriteOpAction.Create && prev) {
          throw new SpaceRecordAlreadyExistsError(collection, rkey)
        }
        if (write.action === WriteOpAction.Update && !prev) {
          throw new SpaceRecordNotFoundError(collection, rkey)
        }
        const row = {
          cid: write.cid.toString(),
          value: encode(write.record),
          repoRev: rev,
          indexedAt: new Date().toISOString(),
        }
        await this.db.db
          .insertInto('space_record')
          .values({ space, collection, rkey, ...row })
          .onConflict((oc) =>
            oc.columns(['space', 'collection', 'rkey']).doUpdateSet(row),
          )
          .execute()
        cid = write.cid
      }

      repo.applyOp({ collection, rkey, cid, prev })
      staged.set(path, cid)
      ops.push({
        space,
        rev,
        // Orders the ops within the rev that wrote them.
        idx: ops.length,
        action: write.action,
        collection,
        rkey,
        cid: cid?.toString() ?? null,
        prev: prev?.toString() ?? null,
      })
    }

    const nextState = repo.setHash.state()
    // Upsert, so a missing row is created rather than silently matching nothing.
    await this.db.db
      .insertInto('space_repo')
      .values({ space, setHash: nextState, rev })
      .onConflict((oc) =>
        oc.column('space').doUpdateSet({ setHash: nextState, rev }),
      )
      .execute()

    await this.db.db.insertInto('space_record_oplog').values(ops).execute()
    await this.processBlobs(space, writes)

    return { rev, setHash: nextState }
  }

  // Until a blob is linked to a record it stays at its temp key, so getBlob would
  // find its metadata but none of its bytes.
  private async processBlobs(
    space: SpaceRefString,
    writes: PreparedWrite[],
  ): Promise<void> {
    await this.blob.deleteDereferencedSpaceBlobs(space, writes)

    for (const write of writes) {
      if (write.action === WriteOpAction.Delete) continue
      for (const blob of write.blobs) {
        await this.blob.associateSpaceBlob(blob, space, write.uri)
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

  // Re-registering an existing service replaces its endpoint and extends its expiry.
  async recordCredentialRecipient(registration: {
    space: string
    serviceDid: string
    serviceEndpoint: string
    expiresAt: string
  }): Promise<void> {
    const { space, serviceDid, serviceEndpoint, expiresAt } = registration
    await this.db.db
      .insertInto('space_credential_recipient')
      .values({ space, serviceDid, serviceEndpoint, expiresAt })
      .onConflict((oc) =>
        oc
          .columns(['space', 'serviceDid'])
          .doUpdateSet({ serviceEndpoint, expiresAt }),
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
