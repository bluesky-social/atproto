import { CID } from 'multiformats/cid'

export interface BlockstoreI {
  get(cid: CID): Promise<Uint8Array>
  put(cid: CID, bytes: Uint8Array): Promise<void>
  has(cid: CID): Promise<boolean>
  destroy(): Promise<void>
}
