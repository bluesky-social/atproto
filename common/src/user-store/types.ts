import { BlockWriter } from '@ipld/car/writer'
import { CID } from 'multiformats/cid'
import { DID } from '../common/types.js'
import TID from './tid.js'

export type UserRoot = Record<string, CID> & { did: DID }

export type SchemaRoot = {
  posts: CID
  relationships: CID
  interactions: CID
  profile: CID | null
}

export type Commit = {
  root: CID
  sig: Uint8Array
}

export type IdMapping = Record<string, CID>

export type Entry = {
  tid: TID
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

export interface CarStreamable {
  writeToCarStream(car: BlockWriter): Promise<void>
}

export interface Collection<T> {
  getEntry(id: T): Promise<CID | null>
  addEntry(id: T, cid: CID): Promise<void>
  editEntry(id: T, cid: CID): Promise<void>
  deleteEntry(id: T): Promise<void>
  cids(): Promise<CID[]>
}

export interface UserStoreI {
  addPost(text: string): Promise<TID>
  editPost(id: TID, text: string): Promise<void>
  deletePost(id: TID): Promise<void>
  listPosts(count: number, from?: TID): Promise<Post[]>

  followUser(username: string, did: string): Promise<void>
  unfollowUser(did: string): Promise<void>
  listFollows(): Promise<Follow[]>

  likePost(postTid: TID): Promise<TID>
  unlikePost(tid: TID): Promise<void>
  listLikes(count: number, from?: TID): Promise<Like[]>

  getCarFile(): Promise<Uint8Array>
}
