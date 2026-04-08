import { TID } from '@atproto/common'
import { encode } from '@atproto/lex-cbor'
import { CommitData, WriteOpAction } from '@atproto/space'
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
        setHash: null,
        rev: null,
        createdAt: timestamp,
      })
      .execute()
  }

  async applyCommit(
    space: string,
    commit: CommitData,
    now?: string,
  ): Promise<string> {
    const rev = TID.nextStr()
    const timestamp = now ?? new Date().toISOString()

    for (const write of commit.writes) {
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
      } else if (write.action === WriteOpAction.Delete) {
        await this.db.db
          .deleteFrom('space_record')
          .where('space', '=', space)
          .where('collection', '=', write.collection)
          .where('rkey', '=', write.rkey)
          .execute()
      }
    }

    // Update space with new set hash and rev
    await this.db.db
      .updateTable('space')
      .set({
        setHash: commit.setHash,
        rev,
      })
      .where('uri', '=', space)
      .execute()

    return rev
  }
}
