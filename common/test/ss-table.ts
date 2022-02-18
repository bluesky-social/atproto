import test from 'ava'

import SSTable from '../src/user-store/ss-table.js'
import IpldStore from '../src/blockstore/ipld-store.js'
import Timestamp from '../src/timestamp.js'

import { wait } from '../src/util.js'
import { CID } from 'multiformats'

type Context = {
  store: IpldStore
  cid: CID
}

test.beforeEach(async t => {
  const store = IpldStore.createInMemory()
  const cid = await store.put({ test: 123 })
  t.context = { store, cid }
  t.pass('Context setup')
})


test('sort keys', async t => {
  // const store = IpldStore.createInMemory()
  // const table = await SSTable.create(store)
  // const cid = await store.put({ test: 123 })

  // for(let i = 0; i < 100; i++) {
  //   await table.addEntry(new Timestamp(), cid)
  //   await wait(1)
  // }

  // const got = await SSTable.get(store, table.cid)
  // const keys = got.keys()
  // console.log("KEYS: ", keys)
  t.pass('pass')
})
