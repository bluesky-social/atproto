import stream from 'stream'
import { CID } from 'multiformats/cid'

export interface BlobStore {
  putTempBytes(bytes: Uint8Array): Promise<string>
  getTempWritableStream(): { file: stream.Writable; tempKey: string }
  moveToPermanent(key: string, cid: CID): Promise<void>
}
