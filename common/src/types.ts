import * as ucan from 'ucans'
import { CID } from 'multiformats/cid'

export type LocalUser = {
  username: string
  keypair: ucan.Keypair & ucan.Didable
}

export type User = {
  name: string
  did: string
  nextPost: number
  postsRoot: CID
  follows: Follow[]
}

export type Follow = {
  username: string
  did: string
}

export type Post = {
  user: string
  text: string
}

export type SignedRoot = {
  user: CID
  sig: Uint8Array
}

export interface BlockstoreI {
  get(cid: CID): Promise<Uint8Array>
  put(cid: CID, bytes: Uint8Array): Promise<void>
}
