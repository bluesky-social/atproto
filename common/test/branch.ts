import test from 'ava'
import { CID } from 'multiformats'

import Branch from '../src/user-store/branch.js'
import IpldStore from '../src/blockstore/ipld-store.js'
import Timestamp from '../src/timestamp.js'
import { wait } from '../src/util.js'


type Context = {
  store: IpldStore
  branch: Branch
  cid: CID
}

test.beforeEach(async t => {
  const store = IpldStore.createInMemory()
  const branch = await Branch.create(store)
  const cid = await store.put({ test: 123 })
  t.context = { store, branch, cid }
  t.pass('Context setup')
})

test("splitting tables", async t => {
  const { branch, cid } = t.context as Context
  for(let i=0; i < 100; i++) {
    await branch.addEntry(Timestamp.now(), cid)
    await wait(1)
  }
  t.is(branch.tableNames().length, 1, "Does not split at 100 entries")

  await branch.addEntry(Timestamp.now(), cid)
  t.is(branch.tableNames().length, 2, "Does split at 101 entries")
})

test("compressing tables", async t => {
  const { branch, cid } = t.context as Context

  for (let i=0; i < 400; i++) {
    await branch.addEntry(Timestamp.now(), cid)
    await wait(1)
  }
  t.is(branch.tableNames().length, 4, "Does not compress at 4 tables")

  await branch.addEntry(Timestamp.now(), cid)
  t.is(branch.tableNames().length, 2, "Compresses oldest 4 tables once there are 5 tables")
})
