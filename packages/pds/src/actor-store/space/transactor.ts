import { TID } from '@atproto/common'
import { encode } from '@atproto/lex-cbor'
import { type Cid, parseCid } from '@atproto/lex-data'
import { WriteOpAction } from '@atproto/repo'
import { LtHash, RepoCommit } from '@atproto/space'
import {
  type AtUriString,
  SpaceRef,
  type SpaceRefString,
} from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { BadRecordSwapError, type PreparedWrite } from '../../repo/types.js'
import type { Policy } from '../../space-policy/policy.js'
import type { BlobTransactor } from '../blob/transactor.js'
import type {
  ActorDb,
  MemberspaceMember,
  SpaceRecordOplog,
} from '../db/index.js'
import { SpaceReader } from './reader.js'

export class SpaceTransactor extends SpaceReader {
  constructor(
    public did: string,
    public db: ActorDb,
    public blob: BlobTransactor,
  ) {
    super(db)
  }

  async ensureSpace(uri: string): Promise<void> {
    const { spaceDid, spaceType } = SpaceRef.parse(uri)
    const space = {
      authority: spaceDid,
      type: spaceType,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    }
    await this.db.db
      .insertInto('space')
      .values({ uri, ...space })
      .onConflict((oc) => oc.column('uri').doUpdateSet({ deletedAt: null }))
      .execute()
    await this.db.db
      .insertInto('space_repo')
      .values({ space: uri, setHash: null, rev: null })
      .onConflict((oc) => oc.column('space').doNothing())
      .execute()
  }

  async createSpace(uri: string, policy: Policy): Promise<void> {
    await this.ensureSpace(uri)
    const policyJson = JSON.stringify(policy)
    await this.db.db
      .insertInto('space_policy')
      .values({ uri, policyJson })
      .onConflict((oc) => oc.column('uri').doUpdateSet({ policyJson }))
      .execute()
  }

  async updateSpacePolicy(uri: string, policy: Policy): Promise<void> {
    await this.db.db
      .updateTable('space_policy')
      .set({ policyJson: JSON.stringify(policy) })
      .where('uri', '=', uri)
      .execute()
  }

  // Delete a space this account is the authority for, including its own repo in the
  // space. The `space` row survives as a tombstone, so getSpaceCredential can
  // keep reporting the space as deleted.
  async deleteSpace(uri: string): Promise<void> {
    await this.db.db
      .updateTable('space')
      .set({ deletedAt: new Date().toISOString() })
      .where('uri', '=', uri)
      .execute()
    await this.blob.deleteSpaceBlobs(uri)
    await this.db.db.deleteFrom('space_policy').where('uri', '=', uri).execute()
    for (const table of [
      'memberspace_member',
      'space_writer',
      'space_credential_recipient',
      'space_record',
      'space_record_oplog',
      'space_repo',
    ] as const) {
      await this.db.db.deleteFrom(table).where('space', '=', uri).execute()
    }
  }

  async putMember(
    space: string,
    did: string,
    access: { read: boolean; write: boolean },
  ): Promise<void> {
    const values: Pick<MemberspaceMember, 'read' | 'write'> = {
      read: access.read ? 1 : 0,
      write: access.write ? 1 : 0,
    }
    await this.db.db
      .insertInto('memberspace_member')
      .values({ space, did, ...values })
      .onConflict((oc) => oc.columns(['space', 'did']).doUpdateSet(values))
      .execute()
  }

  async removeMember(space: string, did: string): Promise<void> {
    await this.db.db
      .deleteFrom('memberspace_member')
      .where('space', '=', space)
      .where('did', '=', did)
      .execute()
  }

  async removeAllMembers(space: string): Promise<void> {
    await this.db.db
      .deleteFrom('memberspace_member')
      .where('space', '=', space)
      .execute()
  }

  /** Record a newer repo state and advance the space sequence atomically. */
  async recordWriter(
    space: string,
    did: string,
    repoRev: string,
    data: Uint8Array,
  ): Promise<{ spaceRev: string; prevSpaceRev?: string } | undefined> {
    this.db.assertTransaction()
    const current = await this.getSpace(space)
    if (!current || current.deletedAt) {
      throw new InvalidRequestError('Space not found', 'SpaceNotFound')
    }
    const writer = await this.db.db
      .selectFrom('space_writer')
      .select('repoRev')
      .where('space', '=', space)
      .where('did', '=', did)
      .executeTakeFirst()
    if (writer && writer.repoRev >= repoRev) return

    const latest = await this.db.db
      .selectFrom('space_writer')
      .select('spaceRev')
      .where('space', '=', space)
      .orderBy('spaceRev', 'desc')
      .limit(1)
      .executeTakeFirst()
    const prevSpaceRev = latest?.spaceRev
    const spaceRev = TID.nextStr(prevSpaceRev)
    await this.db.db
      .insertInto('space_writer')
      .values({ space, did, repoRev, data, spaceRev })
      .onConflict((oc) =>
        oc.columns(['space', 'did']).doUpdateSet({ repoRev, data, spaceRev }),
      )
      .execute()
    return { spaceRev, prevSpaceRev }
  }

  async removeWriter(space: string, did: string): Promise<void> {
    await this.db.db
      .deleteFrom('space_writer')
      .where('space', '=', space)
      .where('did', '=', did)
      .execute()
  }

  /**
   * Apply a batch of writes as one commit, all sharing a single `rev`. Must run in a
   * transaction. Returns null if there was nothing to write.
   */
  async applyWrites(
    space: SpaceRefString,
    writes: PreparedWrite[],
  ): Promise<{ rev: string; setHash: Uint8Array } | null> {
    this.db.assertTransaction()
    if (writes.length === 0) return null

    // A write to another authority's space creates the repo without checking that
    // the space exists. The authority's own spaces must already exist: a write must
    // neither conjure an ungoverned space nor revive a deleted one.
    if (SpaceRef.parse(space).spaceDid === this.did) {
      const existing = await this.getSpace(space)
      if (!existing || existing.deletedAt) {
        throw new InvalidRequestError('Space not found', 'SpaceNotFound')
      }
    }
    await this.ensureSpace(space)

    const state = await this.getRepoState(space)
    const repo = RepoCommit.fromState(state?.setHash)
    const rev = TID.nextStr(state?.rev ?? undefined)

    const ops: SpaceRecordOplog[] = []

    for (const write of writes) {
      const uri = write.uri.toString()
      const { collectionSafe: collection, rkey } = write.uri
      // Each write lands before the next is read, so this sees what the batch has built
      // up so far: a batch can create a record and then update it, and a repeated create
      // is rejected rather than counted into the set hash twice.
      const prev = await this.getRecordCid(uri)

      // No space lexicon offers a swap yet, so this only fires if one starts to —
      // better than accepting a compare-and-swap and not performing it.
      if (write.swapCid && (!prev || !write.swapCid.equals(prev))) {
        throw new BadRecordSwapError(prev)
      }

      let cid: Cid | null = null
      if (write.action === WriteOpAction.Delete) {
        if (!prev) throw new SpaceRecordNotFoundError(collection, rkey)
        await this.db.db
          .deleteFrom('space_record')
          .where('uri', '=', uri)
          .execute()
      } else {
        if (write.action === WriteOpAction.Create && prev) {
          throw new SpaceRecordAlreadyExistsError(collection, rkey)
        }
        if (write.action === WriteOpAction.Update && !prev) {
          throw new SpaceRecordNotFoundError(collection, rkey)
        }
        const record = {
          cid: write.cid.toString(),
          value: encode(write.record),
          repoRev: rev,
          indexedAt: new Date().toISOString(),
        }
        await this.db.db
          .insertInto('space_record')
          .values({ uri, space, collection, rkey, ...record })
          .onConflict((oc) => oc.column('uri').doUpdateSet(record))
          .execute()
        cid = write.cid
      }

      repo.applyOp({ collection, rkey, cid, prev })
      ops.push({
        space,
        rev,
        idx: ops.length,
        action: write.action,
        uri,
        collection,
        rkey,
        cid: cid?.toString() ?? null,
        prev: prev?.toString() ?? null,
      })
    }

    const setHash = repo.setHash.state()
    await this.db.db
      .updateTable('space_repo')
      .set({ setHash, rev })
      .where('space', '=', space)
      .execute()
    await this.db.db.insertInto('space_record_oplog').values(ops).execute()

    await this.blob.deleteDereferencedSpaceBlobs(writes)
    for (const write of writes) {
      if (write.action === WriteOpAction.Delete) continue
      for (const blob of write.blobs) {
        await this.blob.associateSpaceBlob(blob, write.uri)
        await this.blob.verifyBlobAndMakePermanent(blob)
      }
    }

    return { rev, setHash }
  }

  /**
   * Delete every record and clear the oplog, leaving the repo empty at a new `rev`.
   * Must run in a transaction. Returns null if the repo was already empty.
   */
  async clearRecords(
    space: SpaceRefString,
  ): Promise<{ rev: string; setHash: Uint8Array } | null> {
    this.db.assertTransaction()
    const state = await this.getRepoState(space)
    if (!state || new LtHash(state.setHash).isEmpty()) return null

    await this.blob.deleteSpaceBlobs(space)
    await this.db.db
      .deleteFrom('space_record')
      .where('space', '=', space)
      .execute()
    await this.db.db
      .deleteFrom('space_record_oplog')
      .where('space', '=', space)
      .execute()

    const rev = TID.nextStr(state.rev ?? undefined)
    const setHash = new LtHash().state()
    await this.db.db
      .updateTable('space_repo')
      .set({ setHash, rev })
      .where('space', '=', space)
      .execute()

    return { rev, setHash }
  }

  private async getRecordCid(uri: AtUriString): Promise<Cid | null> {
    const row = await this.db.db
      .selectFrom('space_record')
      .select('cid')
      .where('uri', '=', uri)
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
