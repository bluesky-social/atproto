import { CID } from 'multiformats/cid'
import { BlobStore } from '@atproto/repo'
import Database from '../db'
import { cidForData } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AtUri } from '@atproto/uri'

export const addUntetheredBlob = async (
  dbTxn: Database,
  blobs: BlobStore,
  mimeType: string,
  bytes: Uint8Array,
): Promise<CID> => {
  const tempKey = await blobs.putTempBytes(bytes)
  // @TODO calcualte cid with chunking
  const cid = await cidForData(bytes)
  await dbTxn.db
    .insertInto('blob')
    .values({
      cid: cid.toString(),
      mimeType,
      size: bytes.length,
      tempKey,
      width: null,
      height: null,
      createdAt: new Date().toISOString(),
    })
    .execute()
  return cid
}

export const makeBlobPermanent = async (
  dbTxn: Database,
  blobs: BlobStore,
  blobCid: CID,
): Promise<void> => {
  const found = await dbTxn.db
    .selectFrom('blob')
    .selectAll()
    .where('cid', '=', blobCid.toString())
    .executeTakeFirst()
  if (!found) {
    throw new InvalidRequestError(
      `Could not found blob: ${blobCid.toString()}`,
      'BlobNotFound',
    )
  }
  if (found.tempKey) {
    await blobs.moveToPermanent(found.tempKey, blobCid)
    await dbTxn.db
      .updateTable('blob')
      .set({ tempKey: null })
      .where('tempKey', '=', found.tempKey)
      .execute()
  }
}

export const associateBlob = async (
  dbTxn: Database,
  blobCid: CID,
  recordUri: AtUri,
  commit: CID,
  did: string,
): Promise<void> => {
  await dbTxn.db
    .insertInto('repo_blob')
    .values({
      cid: blobCid.toString(),
      recordUri: recordUri.toString(),
      commit: commit.toString(),
      did,
    })
    .onConflict((oc) => oc.doNothing())
    .execute()
}

export class CidNotFound extends Error {
  cid: CID
  constructor(cid: CID) {
    super(`cid not found: ${cid.toString()}`)
    this.cid = cid
  }
}
