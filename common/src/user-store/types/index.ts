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
  author: string
  text: string
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
  // getUser(): Promise<User>

  addPost(text: string): Promise<Timestamp>
  editPost(id: Timestamp, text: string): Promise<void>
  deletePost(id: Timestamp): Promise<void>
  listPosts(count: number, from?: Timestamp): Promise<Post[]>

  reply(id: string, text: string): Promise<void>

  followUser(username: string, did: string): Promise<void>
  unfollowUser(did: string): Promise<void>
  listFollows(): Promise<Follow[]>

  like(id: string): Promise<void>
  unlike(id: string): Promise<void>
  listLikes(): Promise<void>

  getCarStream(): AsyncIterable<Uint8Array>
  getCarFile(): Promise<Uint8Array>
}
