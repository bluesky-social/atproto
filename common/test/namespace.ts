import test from 'ava'

import Namespace from '../src/repo/namespace.js'
import IpldStore from '../src/blockstore/ipld-store.js'
import { IdMapping } from '../src/repo/types.js'

import * as util from './_util.js'

type Context = {
  store: IpldStore
  namespace: Namespace
}

test.beforeEach(async (t) => {
  const store = IpldStore.createInMemory()
  const namespace = await Namespace.create(store)
  t.context = { store, namespace } as Context
  t.pass('Context setup')
})

test('loads from blockstore', async (t) => {
  const { store, namespace } = t.context as Context

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
    t.deepEqual(got, actual[tid.toString()], `Matching content for tid: ${tid}`)
  }
  t.pass('All posts loaded correctly')

  for (const tid of interTids) {
    const got = await loaded.interactions.getEntry(tid)
    t.deepEqual(got, actual[tid.toString()], `Matching content for tid: ${tid}`)
  }
  t.pass('All interactions loaded correctly')

  const got = await loaded.profile
  t.deepEqual(got, actual['profile'], 'Matching contnet for profile')
})
