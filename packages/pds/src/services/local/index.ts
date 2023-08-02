import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import { cborToLexRecord } from '@atproto/repo'
import Database from '../../db'
import { Record as PostRecord } from '../../lexicon/types/app/bsky/feed/post'
import { Record as ProfileRecord } from '../../lexicon/types/app/bsky/actor/profile'
import { ids } from '../../lexicon/lexicons'

export class LocalService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new LocalService(db)
  }

  async getRecordsSinceClock(
    did: string,
    clock: string,
    collections?: string[],
  ): Promise<LocalRecords> {
    let builder = this.db.db
      .selectFrom('record')
      .innerJoin('ipld_block', (join) =>
        join
          .onRef('record.did', '=', 'ipld_block.creator')
          .onRef('record.cid', '=', 'ipld_block.cid'),
      )
      .select([
        'ipld_block.content',
        'uri',
        'ipld_block.cid',
        'record.indexedAt',
      ])
      .where('did', '=', did)
      .where('repoClock', '>', clock)
      .orderBy('repoClock', 'asc')
    if (collections !== undefined && collections.length > 0) {
      builder = builder.where('collection', 'in', collections)
    }
    const res = await builder.execute()
    return res.reduce(
      (acc, cur) => {
        const descript = {
          uri: new AtUri(cur.uri),
          cid: CID.parse(cur.cid),
          indexedAt: cur.indexedAt,
          record: cborToLexRecord(cur.content),
        }
        if (
          descript.uri.collection === ids.AppBskyActorProfile &&
          descript.uri.rkey === 'self'
        ) {
          acc.profile = descript as RecordDescript<ProfileRecord>
        } else if (descript.uri.collection === ids.AppBskyFeedPost) {
          acc.posts.push(descript as RecordDescript<PostRecord>)
        }
        return acc
      },
      { profile: null, posts: [] } as LocalRecords,
    )
  }
}

export type LocalRecords = {
  profile: RecordDescript<ProfileRecord> | null
  posts: RecordDescript<PostRecord>[]
}

export type RecordDescript<T> = {
  uri: AtUri
  cid: CID
  indexedAt: string
  record: T
}
