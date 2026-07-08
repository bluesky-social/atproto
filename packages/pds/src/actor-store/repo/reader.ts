import type { BlobStore } from '@atproto/repo'
import type { SyncEvtData } from '../../repo/index.js'
import { BlobReader } from '../blob/reader.js'
import type { ActorDb } from '../db/index.js'
import { RecordReader } from '../record/reader.js'
import { SqlRepoReader } from './sql-repo-reader.js'

export class RepoReader {
  blob: BlobReader
  record: RecordReader
  storage: SqlRepoReader

  constructor(
    public db: ActorDb,
    public blobstore: BlobStore,
  ) {
    this.blob = new BlobReader(db, blobstore)
    this.record = new RecordReader(db)
    this.storage = new SqlRepoReader(db)
  }

  async getSyncEventData(): Promise<SyncEvtData> {
    const root = await this.storage.getRootDetailed()
    const { blocks } = await this.storage.getBlocks([root.cid])
    return {
      cid: root.cid,
      rev: root.rev,
      blocks,
    }
  }
}
