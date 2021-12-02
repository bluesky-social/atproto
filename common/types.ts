import { CID } from 'multiformats/cid'

export type User = {
  name: string
  nextPost: number
  postsRoot: CID
}

export type Post = {
  user: string
  text: string
}
