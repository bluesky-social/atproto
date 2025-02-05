import { BlobStore } from '@atproto/repo'
import { CID } from 'multiformats/cid'

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
}
