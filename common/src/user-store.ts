import MemoryDB from "./memory-db"
import IpldStore from "./ipld-store"

import { CID } from 'multiformats/cid'
import { sha256 as blockHasher } from 'multiformats/hashes/sha2'

import * as blockCodec from '@ipld/dag-cbor'
import { CarReader, CarWriter } from '@ipld/car'
import { BlockWriter } from '@ipld/car/lib/writer-browser'
import * as hashmap from 'ipld-hashmap'

import { Didable, Keypair } from "ucans"

import { User, Post } from "./types"
import { streamToFile } from './util'

export class UserStore {

  db: MemoryDB
  ipldStore: IpldStore
  postMap: hashmap.HashMap<Post>
  root: CID
  posts: Post[]
  keypair: Keypair

  constructor(db: MemoryDB, ipldStore: IpldStore, postMap: hashmap.HashMap<Post>, root: CID, posts: Post[], keypair: Keypair) {
    this.db = db
    this.ipldStore = ipldStore
    this.postMap = postMap
    this.root = root
    this.posts = posts
    this.keypair = keypair
  }

  static async create(username: string, keypair: Keypair & Didable) {
    const db = new MemoryDB()
    const posts = await hashmap.create(db, { bitWidth: 4, bucketSize: 2, blockHasher, blockCodec }) as hashmap.HashMap<Post>
    const ipldStore = new IpldStore(db)
    const user = {
      did: await keypair.did(),
      name: username,
      nextPost: 0,
      postsRoot: posts.cid,
      follows: []
    }
  
    const userCid = await ipldStore.put(user)
    const signedRoot = {
      user: userCid,
      sig: await keypair.sign(userCid.bytes)
    }

    const root = await ipldStore.put(signedRoot)

    return new UserStore(db, ipldStore, posts, root, [], keypair)
  }

  static async get(root: CID, db: MemoryDB, keypair: Keypair) {
    const ipldStore = new IpldStore(db)
    const rootObj = await ipldStore.getSignedRoot(root)
    const user = await ipldStore.getUser(rootObj.user)
    const postMap = await hashmap.load(db, user.postsRoot, { bitWidth: 4, bucketSize: 2, blockHasher, blockCodec }) as hashmap.HashMap<Post>
    const posts = await UserStore.postsListFromMap(postMap)
    return new UserStore(db, ipldStore, postMap, root, posts, keypair)
  }

  static async fromCarFile(buf: Uint8Array, db: MemoryDB, keypair: Keypair) {
    const car = await CarReader.fromBytes(buf)

    const roots = await car.getRoots()
    if(roots.length !== 1) {
      throw new Error(`Expected one root, got ${roots.length}`)
    }
    const root = roots[0]

    for await (const block of car.blocks()) {
      await db.put(block.cid, block.bytes)
    }

    const ipldStore = new IpldStore(db)
    const rootObj = await ipldStore.getSignedRoot(root)
    const user = await ipldStore.getUser(rootObj.user)
    const postMap = await hashmap.load(db, user.postsRoot, { bitWidth: 4, bucketSize: 2, blockHasher, blockCodec }) as hashmap.HashMap<Post>
    const posts = await UserStore.postsListFromMap(postMap)
    return new UserStore(db, ipldStore, postMap, root, posts, keypair)
  }

  static async postsListFromMap(postMap: hashmap.HashMap<Post>) {
    const posts: Post[] = []
    for await (const [_, val] of postMap.entries()) {
      posts.push(val)
    }
    return posts.reverse()
  }

  async getUser(): Promise<User> {
    const rootObj = await this.ipldStore.getSignedRoot(this.root)
    return this.ipldStore.getUser(rootObj.user)
  }

  async addPost (post: Post): Promise<void> {
    const user = await this.getUser()
    await this.postMap.set(user.nextPost.toString(), post)
    user.nextPost++
    user.postsRoot = this.postMap.cid

    const userCid = await this.ipldStore.put(user)
    const signedRoot = {
      user: userCid,
      sig: await this.keypair.sign(userCid.bytes)
    }
    
    this.root = await this.ipldStore.put(signedRoot)
    this.posts = [post, ...this.posts]
  }

  async refreshPosts(): Promise<Post[]> {
    const posts = await UserStore.postsListFromMap(this.postMap)
    this.posts = posts
    return posts
  }

  getCarStream(): AsyncIterable<Uint8Array> {
    const writeDB = async (car: BlockWriter) => {
      const addCid = async (cid: CID) => {
        car.put({ cid, bytes: await this.db.get(cid) })
      }
      await addCid(this.root)
      const rootObj = await this.ipldStore.getSignedRoot(this.root)
      await addCid(rootObj.user)
      for await (const cid of this.postMap.cids()) {
        await addCid(cid)
      }
      car.close()
    }

    const { writer, out } = CarWriter.create([this.root])
    writeDB(writer)
    return out
  }

  async getCarFile(): Promise<Uint8Array> {
    return streamToFile(this.getCarStream())
  }
}

export default UserStore
