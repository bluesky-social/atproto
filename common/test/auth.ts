import test from 'ava'

import * as ucan from 'ucans'
import { checkUcan, hasAudience } from '../src/auth/ucan-checks.js'
import * as auth from '../src/auth/index.js'
import TID from '../src/repo/tid.js'
import { hasPostingPermission } from '../src/auth/ucan-checks.js'
import { Collection } from '../src/repo/types.js'

type Context = {
  keypair: ucan.EdKeypair
  fullToken: ucan.Chained
  postToken: ucan.Chained
  serverDid: string
  did: string
  namespace: string
  collection: Collection
  tid: TID
}

test.beforeEach(async (t) => {
  const keypair = await ucan.EdKeypair.create()
  const fullToken = await auth.claimFull(keypair.did(), keypair)
  const ucanStore = await ucan.Store.fromTokens([fullToken.encoded()])
  const serverDid = 'did:bsky:FAKE_SERVER_DID'
  const did = keypair.did()
  const namespace = 'did:bsky:microblog'
  const collection = 'posts'
  const tid = TID.next()
  const postToken = await auth.delegateForPost(
    serverDid,
    did,
    namespace,
    collection,
    tid,
    keypair,
    ucanStore,
  )

  t.context = {
    keypair,
    fullToken,
    postToken,
    serverDid,
    did,
    namespace,
    collection,
    tid,
  } as Context
  t.pass('context setup')
})

test('create & validate token for post', async (t) => {
  const ctx = t.context as Context
  await checkUcan(
    ctx.postToken,
    hasAudience(ctx.serverDid),
    hasPostingPermission(ctx.did, ctx.namespace, ctx.collection, ctx.tid),
  )
  t.pass('created & validated token')
})

test('token does not work for other namespaces', async (t) => {
  const ctx = t.context as Context
  await t.throwsAsync(
    checkUcan(
      ctx.postToken,
      hasAudience(ctx.serverDid),
      hasPostingPermission(
        ctx.did,
        'did:bsky:otherNamespace',
        ctx.collection,
        ctx.tid,
      ),
    ),
    { instanceOf: Error },
    'throw when namespace mismatch',
  )
  t.pass('yay')
})

test('token does not work for other collections', async (t) => {
  const ctx = t.context as Context
  await t.throwsAsync(
    checkUcan(
      ctx.postToken,
      hasAudience(ctx.serverDid),
      hasPostingPermission(ctx.did, ctx.namespace, 'interactions', ctx.tid),
    ),
    { instanceOf: Error },
    'throw when collection mismatch',
  )
  t.pass('yay')
})

test('token does not work for other TIDs', async (t) => {
  const ctx = t.context as Context
  const otherTid = TID.next()
  await t.throwsAsync(
    checkUcan(
      ctx.postToken,
      hasAudience(ctx.serverDid),
      hasPostingPermission(ctx.did, ctx.namespace, ctx.collection, otherTid),
    ),
    { instanceOf: Error },
    'throw when tid mismatch',
  )
  t.pass('yay')
})
