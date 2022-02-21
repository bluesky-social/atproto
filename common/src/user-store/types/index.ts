import { CID } from 'multiformats/cid'
import Timestamp from '../timestamp'

export * as check from './check'

export type Root = {
  posts: CID
  relationships: CID
  interactions: CID
}

export type Commit = {
  user: CID
  sig: Uint8Array
}

export type IdMapping = Record<string, CID>

export type Entry = {
  id: Timestamp
  cid: CID
}

// export interface UserStoreI {
//   // getUser(): Promise<User>

//   addPost(text: string): Promise<Timestamp>
//   editPost(id: Timestamp, text: string): Promise<void>
//   deletePost(id: Timestamp): Promise<void>
//   // listPosts(): Promise<Post[]>

//   reply(id: string, text: string): Promise<void>

//   followUser(username: string, did: string): Promise<void>
//   unfollowUser(did: string): Promise<void>
//   // listFollows(): Promise<Follow[]>

//   like(id: string): Promise<void>
//   unlike(id: string): Promise<void>
//   listLikes(): Promise<void>

//   getCarStream(): AsyncIterable<Uint8Array>
//   getCarFile(): Promise<Uint8Array>
// }
