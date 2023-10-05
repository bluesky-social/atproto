import { BlobStore } from '@atproto/repo'
import { SqlRepoReader } from './sql-repo-reader'
import { BlobReader } from '../blob/reader'
import { ActorDb } from '../db'
import { RecordReader } from '../record/reader'

export class RepoReader {
  blob: BlobReader
  record: RecordReader
  storage: SqlRepoReader

  constructor(public db: ActorDb, public blobstore: BlobStore) {
    this.blob = new BlobReader(db, blobstore)
    this.record = new RecordReader(db)
    this.storage = new SqlRepoReader(db)
  }
}
