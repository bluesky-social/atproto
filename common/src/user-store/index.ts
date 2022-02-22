import { CID } from 'multiformats/cid'
import { CarReader, CarWriter } from '@ipld/car'
import { BlockWriter } from '@ipld/car/lib/writer-browser'

import { Didable, Keypair } from 'ucans'

import { Post, Follow, UserStoreI, check, Root, DID } from './types/index.js'
import IpldStore from '../blockstore/ipld-store.js'
import TablesCollection from './tables-collection.js'
import TreeCollection from './tree-collection.js'
import { streamToArray } from '../common/util.js'
import Timestamp from './timestamp.js'

export class UserStore implements UserStoreI {
  ipld: IpldStore
  posts: TablesCollection
  interactions: TablesCollection
  relationships: TreeCollection
  root: CID
  keypair: Keypair | null

  constructor(params: {
    ipld: IpldStore
    posts: TablesCollection
    interactions: TablesCollection
    relationships: TreeCollection
    root: CID
    keypair?: Keypair
  }) {
    this.ipld = params.ipld
    this.posts = params.posts
    this.interactions = params.interactions
    this.relationships = params.relationships
    this.root = params.root
    this.keypair = params.keypair || null
  }

  static async create(
    username: string,
    ipld: IpldStore,
    keypair: Keypair & Didable,
  ) {
    const posts = await TablesCollection.create(ipld)
    const interactions = await TablesCollection.create(ipld)
    const relationships = await TreeCollection.create(ipld)

    const rootObj = {
      did: await keypair.did(),
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
      keypair,
    })
  }

  static async get(root: CID, ipld: IpldStore, keypair?: Keypair) {
    const commit = await ipld.get(root, check.assureCommit)
    const rootObj = await ipld.get(commit.root, check.assureRoot)
    const posts = await TablesCollection.get(ipld, rootObj.posts)
    const interactions = await TablesCollection.get(ipld, rootObj.interactions)
    const relationships = await TreeCollection.get(ipld, rootObj.relationships)
    return new UserStore({
      ipld,
      posts,
      interactions,
      relationships,
      root,
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

    return UserStore.get(root, ipld, keypair)
  }

  async updateRoot(root: Root): Promise<CID> {
    if (this.keypair === null) {
      throw new Error('No keypair provided. UserStore is read-only.')
    }
    const userCid = await this.ipld.put(root)
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
    const root = await this.getRoot()
    const timestamp = Timestamp.now()

    const post = {
      id: timestamp.toString(),
      text,
      author: root.did,
      time: new Date().toISOString(),
    }
    const postCid = await this.ipld.put(post)

    await this.posts.addEntry(timestamp, postCid)

    root.posts = this.posts.cid

    await this.updateRoot(root)
    return timestamp
  }

  async editPost(id: Timestamp, text: string): Promise<void> {
    const root = await this.getRoot()
    const post = {
      id,
      text,
      author: root.did,
      time: new Date().toISOString(),
    }
    const postCid = await this.ipld.put(post)

    await this.posts.editEntry(id, postCid)
    root.posts = this.posts.cid

    await this.updateRoot(root)
  }

  async deletePost(id: Timestamp): Promise<void> {
    const root = await this.getRoot()
    await this.posts.deleteEntry(id)
    root.posts = this.posts.cid
    await this.updateRoot(root)
  }

  async listPosts(): Promise<Post[]> {
    // @TODO: implement with pagination
    return []
  }

  async reply(id: string, text: string): Promise<void> {
    throw new Error('Reply not implemented yet')
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
    const root = await this.getRoot()
    root.relationships = this.relationships.cid
    await this.updateRoot(root)
  }

  async unfollowUser(did: string): Promise<void> {
    await this.relationships.deleteEntry(did)
    const root = await this.getRoot()
    root.relationships = this.relationships.cid
    await this.updateRoot(root)
  }

  async listFollows(): Promise<Follow[]> {
    const cids = await this.relationships.getEntries()
    const follows = await Promise.all(
      cids.map((c) => this.ipld.get(c, check.assureFollow)),
    )
    return follows
  }

  async like(id: string): Promise<void> {
    throw new Error('Like not implemented yet')
  }

  async unlike(id: string): Promise<void> {
    throw new Error('Unlike not implemented yet')
  }

  async listLikes(): Promise<void> {
    throw new Error('list likes not implemented yet')
  }

  // @TODO: split those out onto each branch & SSTable
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
