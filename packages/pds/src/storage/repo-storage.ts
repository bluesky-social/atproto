import { cidForData } from '@atproto/common'
import { RepoStorage } from '@atproto/repo'
import { CID } from 'multiformats/cid'
import Database from '../db'
import BlobDiskStore from './blobs-disk'

export class RepoStorageDisk implements RepoStorage {
  constructor(public db: Database, public blobs: BlobDiskStore) {}

  async addUntetheredBlob(
    did: string,
    mimeType: string,
    bytes: Uint8Array,
  ): Promise<CID> {
    const tempKey = await this.blobs.putTempBytes(bytes)
    // @TODO calcualte cid with chunking
    const cid = await cidForData(bytes)
    await this.db.db
      .insertInto('temp_repo_blob')
      .values({
        cid: cid.toString(),
        tempKey,
        did,
        mimeType,
        createdAt: new Date().toISOString(),
      })
      .execute()
    return cid
  }

  async referenceBlobInCommit(blobCid: CID, commit: CID): Promise<void> {}
}
