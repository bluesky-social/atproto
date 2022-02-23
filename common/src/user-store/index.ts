import { CID } from 'multiformats/cid'
import { CarReader, CarWriter } from '@ipld/car'
import { BlockWriter } from '@ipld/car/lib/writer-browser'

import { Didable, Keypair } from 'ucans'

import { Post, Follow, UserStoreI, Root, DID, Like } from './types.js'
import * as check from './type-check.js'
import IpldStore from '../blockstore/ipld-store.js'
import TidCollection from './tid-collection.js'
import DidCollection from './did-collection.js'
import { streamToArray } from '../common/util.js'
import Timestamp from './timestamp.js'

export class UserStore implements UserStoreI {
  ipld: IpldStore
  posts: TidCollection
  interactions: TidCollection
  relationships: DidCollection
  root: CID
  did: DID
  keypair: Keypair | null

  constructor(params: {
    ipld: IpldStore
    posts: TidCollection
    interactions: TidCollection
    relationships: DidCollection
    root: CID
    did: DID
    keypair?: Keypair
  }) {
    this.ipld = params.ipld
    this.posts = params.posts
    this.interactions = params.interactions
    this.relationships = params.relationships
    this.root = params.root
    this.did = params.did
    this.keypair = params.keypair || null
  }

  static async create(ipld: IpldStore, keypair: Keypair & Didable) {
    const posts = await TidCollection.create(ipld)
    const interactions = await TidCollection.create(ipld)
    const relationships = await DidCollection.create(ipld)
    const did = await keypair.did()

    const rootObj = {
      did: did,
      posts: posts.cid,
      interactions: interactions.cid,
      relationships: relationships.cid,
    }

    const rootCid = await ipld.put(rootObj)
    const commit = {
      root: rootCid,
      sig: await keypair.sign(rootCid.bytes),
    }

    const root = await ipld.put(commit)

    return new UserStore({
      ipld,
      posts,
      interactions,
      relationships,
      root,
      did,
      keypair,
    })
  }

  static async load(root: CID, ipld: IpldStore, keypair?: Keypair) {
    const commit = await ipld.get(root, check.assureCommit)
    const rootObj = await ipld.get(commit.root, check.assureRoot)
    const posts = await TidCollection.load(ipld, rootObj.posts)
    const interactions = await TidCollection.load(ipld, rootObj.interactions)
    const relationships = await DidCollection.load(ipld, rootObj.relationships)
    const did = rootObj.did
    return new UserStore({
      ipld,
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
    ipld: IpldStore,
    keypair?: Keypair,
  ) {
    const car = await CarReader.fromBytes(buf)

    const roots = await car.getRoots()
    if (roots.length !== 1) {
      throw new Error(`Expected one root, got ${roots.length}`)
    }
    const root = roots[0]

    for await (const block of car.blocks()) {
      await ipld.putBytes(block.cid, block.bytes)
    }

    return UserStore.load(root, ipld, keypair)
  }

  async updateRoot(): Promise<CID> {
    if (this.keypair === null) {
      throw new Error('No keypair provided. UserStore is read-only.')
    }
    const userCid = await this.ipld.put({
      did: this.did,
      posts: this.posts.cid,
      relationships: this.relationships.cid,
      interactions: this.interactions.cid,
    })
    const commit = {
      user: userCid,
      sig: await this.keypair.sign(userCid.bytes),
    }

    this.root = await this.ipld.put(commit)
    return this.root
  }

  async getRoot(): Promise<Root> {
    const commit = await this.ipld.get(this.root, check.assureCommit)
    return this.ipld.get(commit.root, check.assureRoot)
  }

  async getPost(id: Timestamp): Promise<Post | null> {
    const postCid = await this.posts.getEntry(id)
    if (postCid === null) return null
    const post = await this.ipld.get(postCid, check.assurePost)
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
    const postCid = await this.ipld.put(post)

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
    const postCid = await this.ipld.put(post)

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
      entries.map((entry) => this.ipld.get(entry.cid, check.assurePost)),
    )
    return posts
  }

  async getFollow(did: DID): Promise<Follow | null> {
    const cid = await this.relationships.getEntry(did)
    if (cid === null) return null
    return this.ipld.get(cid, check.assureFollow)
  }

  async isFollowing(did: DID): Promise<boolean> {
    return this.relationships.hasEntry(did)
  }

  async followUser(username: string, did: string): Promise<void> {
    const follow = { username, did }
    const cid = await this.ipld.put(follow)
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
      cids.map((c) => this.ipld.get(c, check.assureFollow)),
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

    const likeCid = await this.ipld.put(like)

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
      entries.map((entry) => this.ipld.get(entry.cid, check.assureLike)),
    )
    return likes
  }

  // @TODO: split this out onto each collection
  getCarStream(): AsyncIterable<Uint8Array> {
    const writeblockstore = async (car: BlockWriter) => {
      const addCid = async (cid: CID) => {
        car.put({ cid, bytes: await this.ipld.getBytes(cid) })
      }
      await addCid(this.root)
      const commit = await this.ipld.get(this.root, check.assureCommit)
      await addCid(commit.root)

      const [postCids, interactionCids, relationshipCids] = await Promise.all([
        this.posts.cids(),
        this.interactions.cids(),
        this.relationships.cids(),
      ])
      const branchCids = postCids
        .concat(interactionCids)
        .concat(relationshipCids)
      await Promise.all(branchCids.map((c) => addCid(c)))
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
