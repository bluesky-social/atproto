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
  follows: string[]
}

export type Post = {
  user: string
  text: string
}
