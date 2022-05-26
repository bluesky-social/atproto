import test from 'ava'

import * as ucan from 'ucans'
import { checkUcan, hasAudience } from '../src/checks.js'
import * as auth from '../src/index.js'
import { hasPostingPermission } from '../src/checks.js'

type Context = {
  keypair: ucan.EdKeypair
  fullToken: ucan.Chained
  postToken: ucan.Chained
  serverDid: string
  did: string
  collection: string
  schema: string
  record: string
}

test.beforeEach(async (t) => {
  const keypair = await ucan.EdKeypair.create()
  const fullToken = await auth.claimFull(keypair.did(), keypair)
  const ucanStore = await ucan.Store.fromTokens([fullToken.encoded()])
  const serverDid = 'did:example:fakeServerDid'
  const did = keypair.did()
  const collection = 'did:example:microblog'
  const schema = 'did:example:like'
  const record = '3iwc-gvs-ehpk-2s'
  const postToken = await auth.delegateForPost(
    serverDid,
    did,
    collection,
    schema,
    record,
    keypair,
    ucanStore,
  )

  t.context = {
    keypair,
    fullToken,
    postToken,
    serverDid,
    did,
    collection,
    schema,
    record,
  } as Context
  t.pass('context setup')
})

test('create & validate token for post', async (t) => {
  const ctx = t.context as Context
  await checkUcan(
    ctx.postToken,
    hasAudience(ctx.serverDid),
    hasPostingPermission(ctx.did, ctx.collection, ctx.schema, ctx.record),
  )
  t.pass('created & validated token')
})

test('token does not work for other collections', async (t) => {
  const ctx = t.context as Context
  await t.throwsAsync(
    checkUcan(
      ctx.postToken,
      hasAudience(ctx.serverDid),
      hasPostingPermission(
        ctx.did,
        'did:example:otherCollection',
        ctx.schema,
        ctx.record,
      ),
    ),
    { instanceOf: Error },
    'throw when namespace mismatch',
  )
  t.pass('yay')
})

test('token does not work for other TIDs', async (t) => {
  const ctx = t.context as Context
  const otherRecord = '3iwc-gvs-ehpk-2z'
  await t.throwsAsync(
    checkUcan(
      ctx.postToken,
      hasAudience(ctx.serverDid),
      hasPostingPermission(ctx.did, ctx.collection, ctx.schema, otherRecord),
    ),
    { instanceOf: Error },
    'throw when tid mismatch',
  )
  t.pass('yay')
})
