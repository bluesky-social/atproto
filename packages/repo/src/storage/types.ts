import stream from 'stream'
import { CID } from 'multiformats/cid'

export interface BlobStore {
  putTemp(bytes: Uint8Array | stream.Readable): Promise<string>
  moveToPermanent(key: string, cid: CID): Promise<void>
}
