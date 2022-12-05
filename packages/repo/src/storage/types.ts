import { CID } from 'multiformats/cid'

export interface BlobStore {
  putTempBytes(bytes: Uint8Array): Promise<string>
  moveToPermanent(key: string, cid: CID): Promise<void>
}
