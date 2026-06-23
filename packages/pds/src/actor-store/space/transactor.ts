import { TID } from '@atproto/common'
import { encode } from '@atproto/lex-cbor'
import { CommitData, WriteOpAction } from '@atproto/space'
import { ActorDb } from '../db/index.js'
import { SpaceReader } from './reader.js'

export type SpaceConfig = {
  mintPolicy?: string
  managingApp?: string | null
  appAccessType?: string
  appAllowed?: string[]
}

export class SpaceTransactor extends SpaceReader {
  constructor(public db: ActorDb) {
    super(db)
  }

  async createSpace(
    uri: string,
    isOwner: boolean,
    config: SpaceConfig = {},
    now?: string,
  ): Promise<void> {
    const timestamp = now ?? new Date().toISOString()
    await this.db.db
      .insertInto('space')
      .values({
        uri,
        isOwner: isOwner ? 1 : 0,
        mintPolicy: config.mintPolicy ?? 'member-list',
        managingApp: config.managingApp ?? null,
        appAccessType: config.appAccessType ?? 'open',
        appAllowed: JSON.stringify(config.appAllowed ?? []),
        createdAt: timestamp,
        deletedAt: null,
      })
      .execute()
    await this.db.db
      .insertInto('space_repo')
      .values({ space: uri, setHash: null, rev: null })
      .execute()
  }

  // Lazily create the local space row + repo state for a writer's own repo on
  // first write. A writer's PDS isn't told about membership (the member list is
  // the authority's concern), so it materializes the repo when its user writes.
  async ensureSpaceRepo(uri: string, now?: string): Promise<void> {
    const existing = await this.getSpace(uri)
    if (existing) return
    await this.createSpace(uri, false, {}, now)
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
    if (patch.mintPolicy !== undefined) {
      set.mintPolicy = patch.mintPolicy
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
   * Authority-side cleanup of space-scoped data after deletion. Purges the
   * member list and credential recipients. Does NOT touch space_record /
   * space_record_oplog — those belong to the writer's own repo.
   */
  async purgeOwnerSpaceData(uri: string): Promise<void> {
    await this.db.db
      .deleteFrom('space_member')
      .where('space', '=', uri)
      .execute()
    await this.db.db
      .deleteFrom('space_credential_recipient')
      .where('space', '=', uri)
      .execute()
  }

  async applyRepoCommit(
    space: string,
    commit: CommitData,
    now?: string,
  ): Promise<string> {
    // Materialize the local space row + repo state on first write. A writer's
    // PDS isn't told about membership, so its repo is created lazily here.
    await this.ensureSpaceRepo(space, now)
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
