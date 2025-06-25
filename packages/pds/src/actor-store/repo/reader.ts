import { BlobStore } from '@atproto/repo'
import { SyncEvtData } from '../../repo'
import { BlobReader } from '../blob/reader'
import { ActorDb } from '../db'
import { RecordReader } from '../record/reader'
import { SqlRepoReader } from './sql-repo-reader'

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
