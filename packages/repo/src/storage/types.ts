import stream from 'stream'
import { CID } from 'multiformats/cid'

export interface BlobStore {
  putTemp(bytes: Uint8Array | stream.Readable): Promise<string>
  makePermanent(key: string, cid: CID): Promise<void>
  putPermanent(cid: CID, bytes: Uint8Array | stream.Readable): Promise<void>
  getBytes(cid: CID): Promise<Uint8Array>
  getStream(cid: CID): Promise<stream.Readable>
  delete(cid: CID): Promise<void>
}

export class BlobNotFoundError extends Error {}
