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
  author: string
  text: string
  time: string // ISO 8601
}

export type SignedRoot = {
  user: CID
  sig: Uint8Array
}

export interface BlockstoreI {
  get(cid: CID): Promise<Uint8Array>
  put(cid: CID, bytes: Uint8Array): Promise<void>
}

export interface UserStoreI {
  getUser(): Promise<User>

  addPost(text: string): Promise<string>
  editPost(id: string, text: string): Promise<void>
  deletePost(id: string): Promise<void>
  listPosts(): Promise<Post[]>

  reply(id: string, text: string): Promise<void>

  followUser(username: string, did: string): Promise<void>
  unfollowUser(did:string): Promise<void>
  listFollows(): Promise<Follow[]>

  like(id: string): Promise<void>
  unlike(id: string): Promise<void>
  listLikes(): Promise<void>

  getCarStream(): AsyncIterable<Uint8Array>
  getCarFile(): Promise<Uint8Array>
}
