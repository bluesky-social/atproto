import Namespace from '../src/repo/namespace'
import IpldStore from '../src/blockstore/ipld-store'
import { IdMapping } from '../src/repo/types'

import * as util from './_util'

describe('Namespace', () => {
  let store: IpldStore
  let namespace: Namespace

  it('creates namespace', async () => {
    store = IpldStore.createInMemory()
    namespace = await Namespace.create(store)
  })

  it('loads from blockstore', async () => {
    const actual = {} as IdMapping

    const postTids = util.generateBulkTids(150)
    for (const tid of postTids) {
      const cid = await util.randomCid()
      await namespace.posts.addEntry(tid, cid)
      actual[tid.toString()] = cid
    }

    const interTids = util.generateBulkTids(150)
    for (const tid of interTids) {
      const cid = await util.randomCid()
      await namespace.interactions.addEntry(tid, cid)
      actual[tid.toString()] = cid
    }

    const profileCid = await util.randomCid()
    await namespace.setProfile(profileCid)
    actual['profile'] = profileCid

    const loaded = await Namespace.load(store, namespace.cid)
    for (const tid of postTids) {
      const got = await loaded.posts.getEntry(tid)
      expect(got).toEqual(actual[tid.toString()])
    }

    for (const tid of interTids) {
      const got = await loaded.interactions.getEntry(tid)
      expect(got).toEqual(actual[tid.toString()])
    }

    const got = await loaded.profile
    expect(got).toEqual(actual['profile'])
  })
})
