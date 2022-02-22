import { CID } from 'multiformats/cid'
import { CarReader, CarWriter } from '@ipld/car'
import { BlockWriter } from '@ipld/car/lib/writer-browser'

import { Didable, Keypair } from 'ucans'

import { Post, Follow, UserStoreI, check, Root } from './types/index.js'
import IpldStore from '../blockstore/ipld-store.js'
import Branch from './branch.js'
import { streamToArray } from '../common/util.js'
import Timestamp from './timestamp.js'

export class UserStore implements UserStoreI {
  ipld: IpldStore
  posts: Branch
  interactions: Branch
  relationships: Branch
  root: CID
  keypair: Keypair | null

  constructor(params: {
    ipld: IpldStore
    posts: Branch
    interactions: Branch
    relationships: Branch
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
    const posts = await Branch.create(ipld)
    const interactions = await Branch.create(ipld)
    const relationships = await Branch.create(ipld)

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
    const posts = await Branch.get(ipld, rootObj.posts)
    const interactions = await Branch.get(ipld, rootObj.interactions)
    const relationships = await Branch.get(ipld, rootObj.relationships)
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

  async followUser(username: string, did: string): Promise<void> {
    const user = await this.getUser()
    if (user.follows.some((u) => u.username === username)) {
      throw new Error(`User with username ${username} already exists.`)
    } else if (user.follows.some((u) => u.did === did)) {
      throw new Error(`User with did ${did} already exists.`)
    }
    user.follows.push({ username, did })
    await this.updateUserRoot(user)
  }

  async unfollowUser(did: string): Promise<void> {
    const user = await this.getUser()
    const i = user.follows.findIndex((f) => f.did === did)
    user.follows = user.follows.splice(i, 1)
    await this.updateUserRoot(user)
  }

  async listFollows(): Promise<Follow[]> {
    const user = await this.getUser()
    return user.follows
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

  getCarStream(): AsyncIterable<Uint8Array> {
    const writeblockstore = async (car: BlockWriter) => {
      const addCid = async (cid: CID) => {
        car.put({ cid, bytes: await this.ipld.getBytes(cid) })
      }
      await addCid(this.root)
      const commit = await this.ipld.get(this.root, check.assureCommit)
      await addCid(commit.root)

      const [postCids, interactionCids, relationshipCids] = await Promise.all([
        this.posts.nestedCids(),
        this.interactions.nestedCids(),
        this.relationships.nestedCids(),
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
