import test from 'ava'

import ProgramStore from '../src/user-store/program-store.js'
import IpldStore from '../src/blockstore/ipld-store.js'
import { IdMapping } from '../src/user-store/types.js'

import * as util from './_util.js'

type Context = {
  store: IpldStore
  program: ProgramStore
}

test.beforeEach(async (t) => {
  const store = IpldStore.createInMemory()
  const program = await ProgramStore.create(store)
  t.context = { store, program } as Context
  t.pass('Context setup')
})

test('loads from blockstore', async (t) => {
  const { store, program } = t.context as Context

  const actual = {} as IdMapping

  const postTids = util.generateBulkTids(150)
  for (const tid of postTids) {
    const cid = await util.randomCid()
    await program.posts.addEntry(tid, cid)
    actual[tid.toString()] = cid
  }

  const interTids = util.generateBulkTids(150)
  for (const tid of interTids) {
    const cid = await util.randomCid()
    await program.interactions.addEntry(tid, cid)
    actual[tid.toString()] = cid
  }

  const relDids = util.generateBulkDids(100)
  for (const did of relDids) {
    const cid = await util.randomCid()
    await program.relationships.addEntry(did, cid)
    actual[did.toString()] = cid
  }

  const profileCid = await util.randomCid()
  await program.setProfile(profileCid)
  actual['profile'] = profileCid

  const loaded = await ProgramStore.load(store, program.cid)
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

  for (const did of relDids) {
    const got = await loaded.relationships.getEntry(did)
    t.deepEqual(got, actual[did.toString()], `Matching content for did: ${did}`)
  }
  t.pass('All relationships loaded correctly')

  const got = await loaded.profile
  t.deepEqual(got, actual['profile'], 'Matching contnet for profile')
})
