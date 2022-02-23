import { CID } from 'multiformats/cid'
import Timestamp from '../timestamp.js'

export * as check from './check.js'

// @TODO: improve this
export type DID = string

export type Root = {
  did: string
  posts: CID
  relationships: CID
  interactions: CID
}

export type Commit = {
  root: CID
  sig: Uint8Array
}

export type IdMapping = Record<string, CID>

export type Entry = {
  tid: Timestamp
  cid: CID
}

export type Follow = {
  username: string
  did: string
}

export type Post = {
  id: string // @TODO `tid`?
  author: string
  text: string
  time: string // ISO 8601
}

export type Like = {
  id: string
  post_id: string
  author: string
  time: string // ISO 8601
}

export interface Collection<T> {
  getEntry(id: T): Promise<CID | null>
  addEntry(id: T, cid: CID): Promise<void>
  editEntry(id: T, cid: CID): Promise<void>
  deleteEntry(id: T): Promise<void>
  cids(): Promise<CID[]>
}

export interface UserStoreI {
  addPost(text: string): Promise<Timestamp>
  editPost(id: Timestamp, text: string): Promise<void>
  deletePost(id: Timestamp): Promise<void>
  listPosts(count: number, from?: Timestamp): Promise<Post[]>

  followUser(username: string, did: string): Promise<void>
  unfollowUser(did: string): Promise<void>
  listFollows(): Promise<Follow[]>

  likePost(postTid: Timestamp): Promise<Timestamp>
  unlikePost(tid: Timestamp): Promise<void>
  listLikes(count: number, from?: Timestamp): Promise<Like[]>

  getCarStream(): AsyncIterable<Uint8Array>
  getCarFile(): Promise<Uint8Array>
}
