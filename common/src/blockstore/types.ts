import { CID } from 'multiformats/cid'

export interface BlockstoreI {
  get(cid: CID): Promise<Uint8Array>
  put(cid: CID, bytes: Uint8Array): Promise<void>
  destroy(): Promise<void>
}
