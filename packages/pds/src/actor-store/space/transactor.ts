import { TID } from '@atproto/common'
import { encode } from '@atproto/lex-cbor'
import { CommitData, WriteOpAction } from '@atproto/space'
import { ActorDb } from '../db'
import { SpaceReader } from './reader'

export class SpaceTransactor extends SpaceReader {
  constructor(public db: ActorDb) {
    super(db)
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

    // Upsert space root with new set hash
    await this.db.db
      .insertInto('space_root')
      .values({
        space,
        setHash: commit.setHash,
        rev,
        indexedAt: timestamp,
      })
      .onConflict((oc) =>
        oc.column('space').doUpdateSet({
          setHash: commit.setHash,
          rev,
          indexedAt: timestamp,
        }),
      )
      .execute()

    return rev
  }
}
