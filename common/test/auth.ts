import test from 'ava'

import * as ucan from 'ucans'
import { checkUcan, hasAudience } from '../src/auth/ucan-checks.js'
import { delegateToken } from '../src/auth/delegator.js'
import TID from '../src/repo/tid.js'
import { hasPostingPermission } from '../src/auth/ucan-checks.js'
import { Collection } from '../src/repo/types.js'

type Context = {
  keypair: ucan.EdKeypair
  token: ucan.Chained
  serverDid: string
  did: string
  program: string
  collection: Collection
  tid: TID
}

test.beforeEach(async (t) => {
  const keypair = await ucan.EdKeypair.create()
  const serverDid = 'did:bsky:FAKE_SERVER_DID'
  const did = keypair.did()
  const program = 'did:bsky:microblog'
  const collection = 'posts'
  const tid = TID.next()
  const token = await delegateToken(
    serverDid,
    did,
    program,
    collection,
    tid,
    keypair,
  )

  t.context = {
    keypair,
    token,
    serverDid,
    did,
    program,
    collection,
    tid,
  } as Context
  t.pass('context setup')
})

test('create & validate token for post', async (t) => {
  const ctx = t.context as Context
  await checkUcan(
    ctx.token,
    hasAudience(ctx.serverDid),
    hasPostingPermission(ctx.did, ctx.program, ctx.collection, ctx.tid),
  )
  t.pass('created & validated token')
})

test('token does not work for other programs', async (t) => {
  const ctx = t.context as Context
  await t.throwsAsync(
    checkUcan(
      ctx.token,
      hasAudience(ctx.serverDid),
      hasPostingPermission(
        ctx.did,
        'did:bsky:otherProgram',
        ctx.collection,
        ctx.tid,
      ),
    ),
    { instanceOf: Error },
    'throw when program mismatch',
  )
  t.pass('yay')
})

test('token does not work for other collections', async (t) => {
  const ctx = t.context as Context
  await t.throwsAsync(
    checkUcan(
      ctx.token,
      hasAudience(ctx.serverDid),
      hasPostingPermission(ctx.did, ctx.program, 'interactions', ctx.tid),
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
      ctx.token,
      hasAudience(ctx.serverDid),
      hasPostingPermission(ctx.did, ctx.program, ctx.collection, otherTid),
    ),
    { instanceOf: Error },
    'throw when tid mismatch',
  )
  t.pass('yay')
})

test('ucan store', async (t) => {
  const store = await ucan.Store.fromTokens([])
})
