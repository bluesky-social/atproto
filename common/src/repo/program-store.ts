import { CID } from 'multiformats/cid'
import { BlockWriter } from '@ipld/car/lib/writer-browser'

import IpldStore from '../blockstore/ipld-store.js'
import TidCollection from './tid-collection.js'
import { Collection, ProgramRoot, schema, UpdateData } from './types.js'
import CidSet from './cid-set.js'
import TID from './tid.js'

export class ProgramStore {
  blockstore: IpldStore
  posts: TidCollection
  interactions: TidCollection
  profile: CID | null
  cid: CID
  onUpdate: ((update: UpdateData) => Promise<void>) | null

  constructor(params: {
    blockstore: IpldStore
    posts: TidCollection
    interactions: TidCollection
    profile: CID | null
    cid: CID
  }) {
    this.blockstore = params.blockstore
    this.posts = params.posts
    this.interactions = params.interactions
    this.profile = params.profile
    this.cid = params.cid
    this.onUpdate = null

    this.posts.onUpdate = this.updateRoot('posts')
    this.interactions.onUpdate = this.updateRoot('interactions')
  }

  static async create(blockstore: IpldStore) {
    const posts = await TidCollection.create(blockstore)
    const interactions = await TidCollection.create(blockstore)

    const rootObj: ProgramRoot = {
      posts: posts.cid,
      interactions: interactions.cid,
      profile: null,
    }

    const cid = await blockstore.put(rootObj)

    return new ProgramStore({
      blockstore,
      posts,
      interactions,
      profile: null,
      cid,
    })
  }

  static async load(blockstore: IpldStore, cid: CID) {
    const rootObj = await blockstore.get(cid, schema.programRoot)
    const posts = await TidCollection.load(blockstore, rootObj.posts)
    const interactions = await TidCollection.load(
      blockstore,
      rootObj.interactions,
    )
    return new ProgramStore({
      blockstore,
      posts,
      interactions,
      profile: rootObj.profile,
      cid,
    })
  }

  // arrow fn to preserve scope
  updateRoot =
    (collection: Collection) =>
    async (update: UpdateData): Promise<void> => {
      this.cid = await this.blockstore.put({
        posts: this.posts.cid,
        interactions: this.interactions.cid,
        profile: this.profile,
      })
      if (this.onUpdate) {
        await this.onUpdate({
          collection,
          tid: update.tid,
          newCids: update.newCids.add(this.cid),
        })
      }
    }

  async setProfile(cid: CID | null): Promise<void> {
    this.profile = cid
    const newCids = new CidSet(cid === null ? [] : [cid])
    await this.updateRoot('profile')({
      collection: 'profile',
      newCids,
    })
  }

  async writeToCarStream(car: BlockWriter): Promise<void> {
    await this.blockstore.addToCar(car, this.cid)
    if (this.profile !== null) {
      await this.blockstore.addToCar(car, this.profile)
    }
    await Promise.all([
      this.posts.writeToCarStream(car),
      this.interactions.writeToCarStream(car),
    ])
  }
}

export default ProgramStore
