import { CID } from 'multiformats/cid'

export type RawBlobInfo = {
  type: 'blob'
  size: number
  mimeType: string
}

export type ImageInfo = {
  type: 'image'
  size: number
  mimeType: string
  width: number
  height: number
}

export type BlobInfo = RawBlobInfo | ImageInfo

export interface BlobStore {
  putTempBytes(bytes: Uint8Array): Promise<string>
  moveToPermanent(key: string, cid: CID): Promise<void>
  // getInfo(cid: CID): Promise<BlobInfo>
  // getBytes(cid: CID): Promise<Uint8Array>
  // getStream(cid: CID): Promise<ReadableStream>
  // delete(cid: CID): Promise<void>
}

export interface RepoStorage {
  addUntetheredBlob(
    did: string,
    mimeType: string,
    bytes: Uint8Array,
  ): Promise<CID>
  referenceBlobInCommit(blobCid: CID, commit: CID): Promise<void>
}
