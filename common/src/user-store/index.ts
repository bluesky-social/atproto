import { CID } from 'multiformats/cid'
import { CarReader, CarWriter } from '@ipld/car'
import { BlockWriter } from '@ipld/car/lib/writer-browser'

import { Didable, Keypair } from 'ucans'

import {
  Post,
  Follow,
  UserStoreI,
  Root,
  DID,
  Like,
  CarStreamable,
} from './types.js'
import * as check from './type-check.js'
import IpldStore from '../blockstore/ipld-store.js'
import TidCollection from './tid-collection.js'
import DidCollection from './did-collection.js'
import { streamToArray } from '../common/util.js'
import Timestamp from './timestamp.js'

export class UserStore implements UserStoreI, CarStreamable {
  store: IpldStore
  posts: TidCollection
  interactions: TidCollection
  relationships: DidCollection
  root: CID
  did: DID
  keypair: Keypair | null

  constructor(params: {
    store: IpldStore
    posts: TidCollection
    interactions: TidCollection
    relationships: DidCollection
    root: CID
    did: DID
    keypair?: Keypair
  }) {
    this.store = params.store
    this.posts = params.posts
    this.interactions = params.interactions
    this.relationships = params.relationships
    this.root = params.root
    this.did = params.did
    this.keypair = params.keypair || null
  }

  static async create(store: IpldStore, keypair: Keypair & Didable) {
    const posts = await TidCollection.create(store)
    const interactions = await TidCollection.create(store)
    const relationships = await DidCollection.create(store)
    const did = await keypair.did()

    const rootObj = {
      did: did,
      posts: posts.cid,
      interactions: interactions.cid,
      relationships: relationships.cid,
    }

    const rootCid = await store.put(rootObj)
    const commit = {
      root: rootCid,
      sig: await keypair.sign(rootCid.bytes),
    }

    const root = await store.put(commit)

    return new UserStore({
      store,
      posts,
      interactions,
      relationships,
      root,
      did,
      keypair,
    })
  }

  static async load(root: CID, store: IpldStore, keypair?: Keypair) {
    const commit = await store.get(root, check.assureCommit)
    const rootObj = await store.get(commit.root, check.assureRoot)
    const posts = await TidCollection.load(store, rootObj.posts)
    const interactions = await TidCollection.load(store, rootObj.interactions)
    const relationships = await DidCollection.load(store, rootObj.relationships)
    const did = rootObj.did
    return new UserStore({
      store,
      posts,
      interactions,
      relationships,
      root,
      did,
      keypair,
    })
  }

  static async fromCarFile(
    buf: Uint8Array,
    store: IpldStore,
    keypair?: Keypair,
  ) {
    const car = await CarReader.fromBytes(buf)

    const roots = await car.getRoots()
    if (roots.length !== 1) {
      throw new Error(`Expected one root, got ${roots.length}`)
    }
    const root = roots[0]

    for await (const block of car.blocks()) {
      await store.putBytes(block.cid, block.bytes)
    }

    return UserStore.load(root, store, keypair)
  }

  async updateRoot(): Promise<CID> {
    if (this.keypair === null) {
      throw new Error('No keypair provided. UserStore is read-only.')
    }
    const userCid = await this.store.put({
      did: this.did,
      posts: this.posts.cid,
      relationships: this.relationships.cid,
      interactions: this.interactions.cid,
    })
    const commit = {
      user: userCid,
      sig: await this.keypair.sign(userCid.bytes),
    }

    this.root = await this.store.put(commit)
    return this.root
  }

  async getRoot(): Promise<Root> {
    const commit = await this.store.get(this.root, check.assureCommit)
    return this.store.get(commit.root, check.assureRoot)
  }

  async getPost(id: Timestamp): Promise<Post | null> {
    const postCid = await this.posts.getEntry(id)
    if (postCid === null) return null
    const post = await this.store.get(postCid, check.assurePost)
    return post
  }

  async addPost(text: string): Promise<Timestamp> {
    const tid = Timestamp.now()

    const post = {
      id: tid.toString(),
      text,
      author: this.did,
      time: new Date().toISOString(),
    }
    const postCid = await this.store.put(post)

    await this.posts.addEntry(tid, postCid)

    await this.updateRoot()
    return tid
  }

  async editPost(tid: Timestamp, text: string): Promise<void> {
    const post = {
      id: tid,
      text,
      author: this.did,
      time: new Date().toISOString(),
    }
    const postCid = await this.store.put(post)

    await this.posts.editEntry(tid, postCid)
    await this.updateRoot()
  }

  async deletePost(tid: Timestamp): Promise<void> {
    await this.posts.deleteEntry(tid)
    await this.updateRoot()
  }

  async listPosts(count: number, from?: Timestamp): Promise<Post[]> {
    const entries = await this.posts.getEntries(count, from)
    const posts = await Promise.all(
      entries.map((entry) => this.store.get(entry.cid, check.assurePost)),
    )
    return posts
  }

  async getFollow(did: DID): Promise<Follow | null> {
    const cid = await this.relationships.getEntry(did)
    if (cid === null) return null
    return this.store.get(cid, check.assureFollow)
  }

  async isFollowing(did: DID): Promise<boolean> {
    return this.relationships.hasEntry(did)
  }

  async followUser(username: string, did: string): Promise<void> {
    const follow = { username, did }
    const cid = await this.store.put(follow)
    await this.relationships.addEntry(did, cid)
    await this.updateRoot()
  }

  async unfollowUser(did: string): Promise<void> {
    await this.relationships.deleteEntry(did)
    await this.updateRoot()
  }

  async listFollows(): Promise<Follow[]> {
    const cids = await this.relationships.getEntries()
    const follows = await Promise.all(
      cids.map((c) => this.store.get(c, check.assureFollow)),
    )
    return follows
  }

  async likePost(postTid: Timestamp): Promise<Timestamp> {
    const tid = Timestamp.now()
    const like = {
      id: tid.toString(),
      post_id: postTid.toString(),
      author: this.did,
      time: new Date().toISOString(),
    }

    const likeCid = await this.store.put(like)

    await this.interactions.addEntry(tid, likeCid)

    await this.updateRoot()
    return tid
  }

  async unlikePost(tid: Timestamp): Promise<void> {
    await this.interactions.deleteEntry(tid)
    await this.updateRoot()
  }

  async listLikes(count: number, from?: Timestamp): Promise<Like[]> {
    const entries = await this.interactions.getEntries(count, from)
    const likes = await Promise.all(
      entries.map((entry) => this.store.get(entry.cid, check.assureLike)),
    )
    return likes
  }

  async writeToCarStream(car: BlockWriter): Promise<void> {
    await this.store.addToCar(car, this.root)
    const commit = await this.store.get(this.root, check.assureCommit)
    await this.store.addToCar(car, commit.root)
    await Promise.all([
      this.posts.writeToCarStream(car),
      this.interactions.writeToCarStream(car),
      this.relationships.writeToCarStream(car),
    ])
  }

  async getCarFile(): Promise<Uint8Array> {
    const { writer, out } = CarWriter.create([this.root])
    await this.writeToCarStream(writer)
    writer.close()
    return streamToArray(out)
  }
}

export default UserStore
