import stream from 'stream'
import { CID } from 'multiformats/cid'

export interface BlobStore {
  putTemp(bytes: Uint8Array | stream.Readable): Promise<string>
  makePermanent(key: string, cid: CID): Promise<void>
  getBytes(cid: CID): Promise<Uint8Array>
}
