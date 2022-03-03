import { CID } from 'multiformats/cid'
import { BlockWriter } from '@ipld/car/lib/writer-browser'

import * as check from './type-check.js'
import IpldStore from '../blockstore/ipld-store.js'
import TidCollection from './tid-collection.js'
import DidCollection from './did-collection.js'
import { ProgramRoot } from './types.js'

export class ProgramStore {
  store: IpldStore
  posts: TidCollection
  interactions: TidCollection
  relationships: DidCollection
  profile: CID | null
  cid: CID

  constructor(params: {
    store: IpldStore
    posts: TidCollection
    interactions: TidCollection
    relationships: DidCollection
    profile: CID | null
    cid: CID
  }) {
    this.store = params.store
    this.posts = params.posts
    this.interactions = params.interactions
    this.relationships = params.relationships
    this.profile = params.profile
    this.cid = params.cid

    this.posts.onUpdate = () => this.updateRoot()
    this.interactions.onUpdate = () => this.updateRoot()
    this.relationships.onUpdate = () => this.updateRoot()
  }

  static async create(store: IpldStore) {
    const posts = await TidCollection.create(store)
    const interactions = await TidCollection.create(store)
    const relationships = await DidCollection.create(store)

    const rootObj: ProgramRoot = {
      posts: posts.cid,
      interactions: interactions.cid,
      relationships: relationships.cid,
      profile: null,
    }

    const cid = await store.put(rootObj)

    return new ProgramStore({
      store,
      posts,
      interactions,
      relationships,
      profile: null,
      cid,
    })
  }

  static async load(store: IpldStore, cid: CID) {
    const rootObj = await store.get(cid, check.assureProgramRoot)
    const posts = await TidCollection.load(store, rootObj.posts)
    const interactions = await TidCollection.load(store, rootObj.interactions)
    const relationships = await DidCollection.load(store, rootObj.relationships)
    return new ProgramStore({
      store,
      posts,
      interactions,
      relationships,
      profile: rootObj.profile,
      cid,
    })
  }

  // arrow fn to preserve scope
  async updateRoot(): Promise<void> {
    this.cid = await this.store.put({
      posts: this.posts.cid,
      relationships: this.relationships.cid,
      interactions: this.interactions.cid,
      profile: this.profile,
    })
  }

  async setProfile(cid: CID | null): Promise<void> {
    this.profile = cid
    await this.updateRoot()
  }

  async writeToCarStream(car: BlockWriter): Promise<void> {
    await this.store.addToCar(car, this.cid)
    if (this.profile !== null) {
      await this.store.addToCar(car, this.profile)
    }
    await Promise.all([
      this.posts.writeToCarStream(car),
      this.interactions.writeToCarStream(car),
      this.relationships.writeToCarStream(car),
    ])
  }
}

export default ProgramStore
