import { TID } from '@atproto/common'
import { encode } from '@atproto/lex-cbor'
import {
  CommitData,
  MemberCommitData,
  MemberOpAction,
  WriteOpAction,
} from '@atproto/space'
import { ActorDb } from '../db'
import { SpaceReader } from './reader'

export class SpaceTransactor extends SpaceReader {
  constructor(public db: ActorDb) {
    super(db)
  }

  async createSpace(
    uri: string,
    isOwner: boolean,
    now?: string,
  ): Promise<void> {
    const timestamp = now ?? new Date().toISOString()
    await this.db.db
      .insertInto('space')
      .values({
        uri,
        isOwner: isOwner ? 1 : 0,
        isMember: 0,
        createdAt: timestamp,
      })
      .execute()
    await this.db.db
      .insertInto('space_repo')
      .values({ space: uri, setHash: null, rev: null })
      .execute()
    if (isOwner) {
      await this.db.db
        .insertInto('space_member_state')
        .values({ space: uri, setHash: null, rev: null })
        .execute()
    }
  }

  async addMember(space: string, did: string, now?: string): Promise<void> {
    const timestamp = now ?? new Date().toISOString()
    await this.db.db
      .insertInto('space_member')
      .values({ space, did, memberRev: '', addedAt: timestamp })
      .execute()
  }

  async removeMember(space: string, did: string): Promise<void> {
    await this.db.db
      .deleteFrom('space_member')
      .where('space', '=', space)
      .where('did', '=', did)
      .execute()
  }

  async deleteSpace(uri: string): Promise<void> {
    // Clean up all related tables
    await this.db.db
      .deleteFrom('space_record')
      .where('space', '=', uri)
      .execute()
    await this.db.db
      .deleteFrom('space_member')
      .where('space', '=', uri)
      .execute()
    await this.db.db
      .deleteFrom('space_repo')
      .where('space', '=', uri)
      .execute()
    await this.db.db
      .deleteFrom('space_member_state')
      .where('space', '=', uri)
      .execute()
    await this.db.db
      .deleteFrom('space_record_oplog')
      .where('space', '=', uri)
      .execute()
    await this.db.db
      .deleteFrom('space_member_oplog')
      .where('space', '=', uri)
      .execute()
    await this.db.db
      .deleteFrom('space_credential_recipient')
      .where('space', '=', uri)
      .execute()
    await this.db.db.deleteFrom('space').where('uri', '=', uri).execute()
  }

  async applyRepoCommit(
    space: string,
    commit: CommitData,
    now?: string,
  ): Promise<string> {
    const rev = TID.nextStr()
    const timestamp = now ?? new Date().toISOString()
    let idx = 0

    for (const write of commit.writes) {
      // Look up existing CID for prev field
      const existing = await this.db.db
        .selectFrom('space_record')
        .select('cid')
        .where('space', '=', space)
        .where('collection', '=', write.collection)
        .where('rkey', '=', write.rkey)
        .executeTakeFirst()
      const prev = existing?.cid ?? null

      if (
        write.action === WriteOpAction.Create ||
        write.action === WriteOpAction.Update
      ) {
        const value = encode(write.record)
        await this.db.db
          .insertInto('space_record')
          .values({
            space,
            collection: write.collection,
            rkey: write.rkey,
            cid: write.cid.toString(),
            value,
            repoRev: rev,
            indexedAt: timestamp,
          })
          .onConflict((oc) =>
            oc.columns(['space', 'collection', 'rkey']).doUpdateSet({
              cid: write.cid.toString(),
              value,
              repoRev: rev,
              indexedAt: timestamp,
            }),
          )
          .execute()
        // Append to oplog
        await this.db.db
          .insertInto('space_record_oplog')
          .values({
            space,
            rev,
            idx,
            action: write.action,
            collection: write.collection,
            rkey: write.rkey,
            cid: write.cid.toString(),
            prev,
          })
          .execute()
      } else if (write.action === WriteOpAction.Delete) {
        await this.db.db
          .deleteFrom('space_record')
          .where('space', '=', space)
          .where('collection', '=', write.collection)
          .where('rkey', '=', write.rkey)
          .execute()
        // Append to oplog
        await this.db.db
          .insertInto('space_record_oplog')
          .values({
            space,
            rev,
            idx,
            action: write.action,
            collection: write.collection,
            rkey: write.rkey,
            cid: null,
            prev,
          })
          .execute()
      }
      idx++
    }

    // Update space_repo with new set hash and rev
    await this.db.db
      .updateTable('space_repo')
      .set({ setHash: commit.setHash, rev })
      .where('space', '=', space)
      .execute()

    return rev
  }

  async applyMemberCommit(
    space: string,
    commit: MemberCommitData,
  ): Promise<string> {
    const rev = TID.nextStr()
    const timestamp = new Date().toISOString()
    let idx = 0

    for (const op of commit.ops) {
      if (op.action === MemberOpAction.Add) {
        await this.db.db
          .insertInto('space_member')
          .values({ space, did: op.did, memberRev: rev, addedAt: timestamp })
          .execute()
      } else if (op.action === MemberOpAction.Remove) {
        await this.db.db
          .deleteFrom('space_member')
          .where('space', '=', space)
          .where('did', '=', op.did)
          .execute()
      }
      await this.db.db
        .insertInto('space_member_oplog')
        .values({ space, rev, idx, action: op.action, did: op.did })
        .execute()
      idx++
    }

    await this.db.db
      .updateTable('space_member_state')
      .set({ setHash: commit.setHash, rev })
      .where('space', '=', space)
      .execute()

    return rev
  }

  async updateMembership(space: string, isMember: boolean): Promise<void> {
    await this.db.db
      .updateTable('space')
      .set({ isMember: isMember ? 1 : 0 })
      .where('uri', '=', space)
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
}
