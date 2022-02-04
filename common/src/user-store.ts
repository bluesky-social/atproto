import IpldStore from "./ipld-store.js"

import { CID } from 'multiformats/cid'
import { sha256 as blockHasher } from 'multiformats/hashes/sha2'

import * as blockCodec from '@ipld/dag-cbor'
import { CarReader, CarWriter } from '@ipld/car'
import { BlockWriter } from '@ipld/car/lib/writer-browser'
import * as hashmap from 'ipld-hashmap'

import { Didable, Keypair } from "ucans"

import { User, Post, BlockstoreI, Follow, UserStoreI } from "./types.js"
import { streamToArray } from './util.js'

export class UserStore implements UserStoreI {

  blockstore: BlockstoreI
  ipldStore: IpldStore
  postMap: hashmap.HashMap<Post>
  root: CID
  keypair: Keypair | null

  constructor(params: {
    blockstore: BlockstoreI, 
    ipldStore: IpldStore, 
    postMap: hashmap.HashMap<Post>, 
    root: CID, 
    keypair?: Keypair
  }) {
    this.blockstore = params.blockstore
    this.ipldStore = params.ipldStore
    this.postMap = params.postMap
    this.root = params.root
    this.keypair = params.keypair || null
  }

  static async create(username: string, blockstore: BlockstoreI, keypair: Keypair & Didable) {
    const postMap = await hashmap.create(blockstore, { bitWidth: 4, bucketSize: 2, blockHasher, blockCodec }) as hashmap.HashMap<Post>
    const ipldStore = new IpldStore(blockstore)
    const user = {
      did: await keypair.did(),
      name: username,
      nextPost: 0,
      postsRoot: postMap.cid,
      follows: []
    }
  
    const userCid = await ipldStore.put(user)
    const signedRoot = {
      user: userCid,
      sig: await keypair.sign(userCid.bytes)
    }

    const root = await ipldStore.put(signedRoot)

    return new UserStore({
      blockstore, 
      ipldStore, 
      postMap, 
      root, 
      keypair
    })
  }

  static async get(root: CID, blockstore: BlockstoreI, keypair?: Keypair) {
    const ipldStore = new IpldStore(blockstore)
    const rootObj = await ipldStore.getSignedRoot(root)
    const user = await ipldStore.getUser(rootObj.user)
    const postMap = await hashmap.load(blockstore, user.postsRoot, { bitWidth: 4, bucketSize: 2, blockHasher, blockCodec }) as hashmap.HashMap<Post>
    return new UserStore({
      blockstore,
      ipldStore,
      postMap,
      root,
      keypair
    })
  }

  static async fromCarFile(buf: Uint8Array, blockstore: BlockstoreI, keypair?: Keypair) {
    const car = await CarReader.fromBytes(buf)

    const roots = await car.getRoots()
    if(roots.length !== 1) {
      throw new Error(`Expected one root, got ${roots.length}`)
    }
    const root = roots[0]

    for await (const block of car.blocks()) {
      await blockstore.put(block.cid, block.bytes)
    }

    const ipldStore = new IpldStore(blockstore)
    const rootObj = await ipldStore.getSignedRoot(root)
    const user = await ipldStore.getUser(rootObj.user)
    const postMap = await hashmap.load(blockstore, user.postsRoot, { bitWidth: 4, bucketSize: 2, blockHasher, blockCodec }) as hashmap.HashMap<Post>
    return new UserStore({
      blockstore,
      ipldStore,
      postMap,
      root,
      keypair
    })
  }

  async updateUserRoot(user: User): Promise<CID> {
    if (this.keypair === null) {
      throw new Error("No keypair provided. UserStore is read-only.")
    }
    const userCid = await this.ipldStore.put(user)
    const signedRoot = {
      user: userCid,
      sig: await this.keypair.sign(userCid.bytes)
    }
    
    this.root = await this.ipldStore.put(signedRoot)
    return this.root
  }

  async getUser(): Promise<User> {
    const rootObj = await this.ipldStore.getSignedRoot(this.root)
    return this.ipldStore.getUser(rootObj.user)
  }

  async addPost (text: string): Promise<string> {
    const user = await this.getUser()
    const post = {
      text,
      author: user.did,
      time: (new Date()).toISOString()
    }

    const id = user.nextPost.toString()
    await this.postMap.set(id, post)

    user.nextPost++
    user.postsRoot = this.postMap.cid

    await this.updateUserRoot(user)
    return id
  }

  async editPost(id: string, text: string): Promise<void> {
    const user = await this.getUser()
    const post = {
      text,
      author: user.did,
      time: (new Date()).toISOString()
    }

    await this.postMap.set(id, post)
    user.postsRoot = this.postMap.cid

    await this.updateUserRoot(user)
  }

  async deletePost(id: string): Promise<void> {
    const user = await this.getUser()
    await this.postMap.delete(id)
    user.postsRoot = this.postMap.cid
    await this.updateUserRoot(user)
  }

  async listPosts(): Promise<Post[]> {
    const posts: Post[] = []
    for await (const [_, val] of this.postMap.entries()) {
      posts.push(val)
    }
    return posts.reverse()
  }

  async reply(id: string, text: string): Promise<void> {
    throw new Error("Reply not implemented yet")
  }

  async followUser(username: string, did: string): Promise<void> {
    const user = await this.getUser()
    if (user.follows.some(u => u.username === username)) {
      throw new Error(`User with username ${username} already exists.`)

    } else if (user.follows.some(u => u.did === did)) {
      throw new Error(`User with did ${did} already exists.`)
    }
    user.follows.push({ username, did })
    await this.updateUserRoot(user)
  }

  async unfollowUser(did: string): Promise<void> {
    const user = await this.getUser()
    const i = user.follows.findIndex((f => f.did === did))
    user.follows = user.follows.splice(i, 1)
    await this.updateUserRoot(user)
  }

  async listFollows(): Promise<Follow[]> {
    const user = await this.getUser()
    return user.follows
  }

  async like(id: string): Promise<void> {
    throw new Error("Like not implemented yet")
  }

  async unlike(id: string): Promise<void> {
    throw new Error("Unlike not implemented yet")
  }

  async listLikes(): Promise<void> {
    throw new Error("list likes not implemented yet")
  }

  getCarStream(): AsyncIterable<Uint8Array> {
    const writeblockstore = async (car: BlockWriter) => {
      const addCid = async (cid: CID) => {
        car.put({ cid, bytes: await this.blockstore.get(cid) })
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
    writeblockstore(writer)
    return out
  }

  async getCarFile(): Promise<Uint8Array> {
    return streamToArray(this.getCarStream())
  }
}

export default UserStore
