import test from 'ava'

import * as ucan from 'ucans'

import UserStore from '../src/user-store/index.js'
import IpldStore from '../src/blockstore/ipld-store.js'

import * as util from './_util.js'
import TID from '../src/user-store/tid.js'

type Context = {
  ipld: IpldStore
  keypair: ucan.EdKeypair
  store: UserStore
  programName: string
  otherProgram: string
}

test.beforeEach(async (t) => {
  const ipld = IpldStore.createInMemory()
  const keypair = await ucan.EdKeypair.create()
  const store = await UserStore.create(ipld, keypair)
  const programName = 'did:bsky:test'
  const otherProgram = 'did:bsky:other'
  t.context = { ipld, keypair, store, programName, otherProgram } as Context
  t.pass('Context setup')
})

test('adds a valid signature to commit', async (t) => {
  const { store } = t.context as Context

  const commit = await store.getCommit()
  const verified = await ucan.verifySignature(
    commit.root.bytes,
    commit.sig,
    store.did,
  )
  t.true(verified, 'signature matches DID of root')
})

test('sets correct DID', async (t) => {
  const { store, keypair } = t.context as Context
  t.is(store.did, keypair.did(), 'DIDs match')
})

test('runs operations on the related program', async (t) => {
  const { store, programName } = t.context as Context

  const tid = TID.next()
  const cid = await util.randomCid()
  await store.runOnProgram(programName, async (program) => {
    await program.posts.addEntry(tid, cid)
  })

  const got = await store.runOnProgram(programName, async (program) => {
    return program.posts.getEntry(tid)
  })
  t.deepEqual(got, cid, `Matching content for post tid: ${tid}`)
})

test('name spaces programs', async (t) => {
  const { store, programName, otherProgram } = t.context as Context

  const tid = TID.next()
  const cid = await util.randomCid()
  await store.runOnProgram(programName, async (program) => {
    await program.posts.addEntry(tid, cid)
  })

  const tidOther = TID.next()
  const cidOther = await util.randomCid()
  await store.runOnProgram(otherProgram, async (program) => {
    await program.posts.addEntry(tidOther, cidOther)
  })

  const got = await store.runOnProgram(programName, async (program) => {
    return Promise.all([
      program.posts.getEntry(tid),
      program.posts.getEntry(tidOther),
    ])
  })
  t.deepEqual(got[0], cid, 'correctly retrieves tid from program')
  t.deepEqual(got[1], null, 'cannot find tid from other program')

  const gotOther = await store.runOnProgram(otherProgram, async (program) => {
    return Promise.all([
      program.posts.getEntry(tid),
      program.posts.getEntry(tidOther),
    ])
  })
  t.deepEqual(gotOther[0], null, 'cannot find tid from other program')
  t.deepEqual(gotOther[1], cidOther, 'correctly retrieves tid from program')
})

test('loads from blockstore', async (t) => {
  const { ipld, store, programName } = t.context as Context
  const postTid = TID.next()
  const postCid = await util.randomCid()
  const interTid = TID.next()
  const interCid = await util.randomCid()
  const relDid = util.randomDid()
  const relCid = await util.randomCid()

  await store.runOnProgram(programName, async (program) => {
    await program.posts.addEntry(postTid, postCid)
    await program.interactions.addEntry(interTid, interCid)
    await program.relationships.addEntry(relDid, relCid)
  })

  const loaded = await UserStore.load(ipld, store.cid)
  const got = await loaded.runOnProgram(programName, async (program) => {
    return Promise.all([
      program.posts.getEntry(postTid),
      program.interactions.getEntry(interTid),
      program.relationships.getEntry(relDid),
    ])
  })
  t.deepEqual(got[0], postCid, 'loads posts from blockstore')
  t.deepEqual(got[1], interCid, 'loads interaction from blockstore')
  t.deepEqual(got[2], relCid, 'loads relationships from blockstore')
})
