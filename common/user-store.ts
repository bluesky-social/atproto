import MemoryDB from "./memory-db"
import IpldStore from "./ipld-store"

import { CID } from 'multiformats/cid'
import { sha256 as blockHasher } from 'multiformats/hashes/sha2'
import * as blockCodec from '@ipld/dag-cbor'

import * as hashmap from 'ipld-hashmap'
import { User, Post } from "./types"
import { CarReader } from '@ipld/car'

export default class UserStore {

  db: MemoryDB
  ipldStore: IpldStore
  postMap: hashmap.HashMap<Post>
  root: CID
  posts: Post[]

  constructor(db: MemoryDB, ipldStore: IpldStore, postMap: hashmap.HashMap<Post>, root: CID, posts: Post[]) {
    this.db = db
    this.ipldStore = ipldStore
    this.postMap = postMap
    this.root = root
    this.posts = posts
  }

  static async create(username: string) {
    const db = new MemoryDB()
    const posts = await hashmap.create(db, { bitWidth: 4, bucketSize: 2, blockHasher, blockCodec }) as hashmap.HashMap<Post>
    const ipldStore = new IpldStore(db)
    const user = {
      name: username,
      nextPost: 0,
      postsRoot: posts.cid
    }
    const root = await ipldStore.put(user)
    return new UserStore(db, ipldStore, posts, root, [])
  }

  static async get(root: CID, db: MemoryDB) {
    const ipldStore = new IpldStore(db)
    const user = await ipldStore.get(root)
    const postMap = await hashmap.load(db, user.postsRoot, { bitWidth: 4, bucketSize: 2, blockHasher, blockCodec }) as hashmap.HashMap<Post>
    const posts = await UserStore.postsListFromMap(postMap)
    return new UserStore(db, ipldStore, postMap, root, posts)
  }

  static async fromCarFile(buf: Uint8Array) {
    const car = await CarReader.fromBytes(buf)

    const roots = await car.getRoots()
    if(roots.length !== 1) {
      throw new Error(`Expected one root, got ${roots.length}`)
    }
    const root = roots[0]

    const db = new MemoryDB()
    for await (const block of car.blocks()) {
      await db.put(block.cid, block.bytes)
    }

    const ipldStore = new IpldStore(db)
    const user = await ipldStore.get(root)

    const postMap = await hashmap.load(db, user.postsRoot, { bitWidth: 4, bucketSize: 2, blockHasher, blockCodec }) as hashmap.HashMap<Post>
    const posts = await UserStore.postsListFromMap(postMap)
    return new UserStore(db, ipldStore, postMap, root, posts)
  }

  static async postsListFromMap(postMap: hashmap.HashMap<Post>) {
    const posts = []
    for await (const [_, val] of postMap.entries()) {
      posts.push(val)
    }
    return posts
  }

  async getUser(): Promise<User> {
    return this.ipldStore.get(this.root)
  }

  async addPost (post: Post): Promise<void> {
    const user = await this.getUser()
    await this.postMap.set(user.nextPost.toString(), post)
    user.nextPost++
    user.postsRoot = this.postMap.cid
    this.root = await this.ipldStore.put(user)
    this.posts.push(post)
  }

  async refreshPosts(): Promise<Post[]> {
    const posts = await UserStore.postsListFromMap(this.postMap)
    this.posts = posts
    return posts
  }

  getCarStream(): AsyncIterable<Uint8Array> {
    return this.db.getCarStream(this.root)
  }

  async getCarFile(): Promise<Uint8Array> {
    return this.db.getCarFile(this.root)
  }

}
