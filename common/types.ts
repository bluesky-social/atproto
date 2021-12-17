import * as ucan from 'ucans'
import { CID } from 'multiformats/cid'

export type LocalUser = {
  username: string
  keypair: ucan.Keypair
}

export type User = {
  name: string
  nextPost: number
  postsRoot: CID
}

export type Post = {
  user: string
  text: string
}
