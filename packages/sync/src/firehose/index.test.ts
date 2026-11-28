import { assert, describe, expect, it } from 'vitest'
import { createDeferrable } from '@atproto/common'
import { Secp256k1Keypair } from '@atproto/crypto'
import type { DidString } from '@atproto/lex-schema'
import { RepoVerificationError } from '@atproto/repo'
import type { Event } from '../events.js'
import { MemoryRunner } from '../runner/index.js'
import { StubPds, type TestPost } from './_stub-pds.js'
import { Firehose, type FirehoseOptions, FirehoseParseError } from './index.js'

async function readFirehose(
  pds: StubPds,
  isComplete: (events: Event[]) => boolean,
  opts: Partial<FirehoseOptions> = {},
): Promise<Event[]> {
  const done = createDeferrable()
  const events: Event[] = []
  const firehose = new Firehose({
    idResolver: pds.idResolver,
    service: pds.url,
    handleEvent: (evt) => {
      events.push(evt)
      if (isComplete(events)) done.resolve()
    },
    onError: (err) => done.reject(err),
    ...opts,
  })
  const running = firehose.start()
  try {
    await done.complete
    return events
  } finally {
    await firehose.destroy()
    await running
  }
}

function expectedCreate(post: TestPost, seq: number = expect.any(Number)) {
  return {
    event: 'create',
    seq,
    did: post.uri.did,
    collection: post.uri.collection,
    rkey: post.uri.rkey,
    cid: post.cid,
    commit: post.commit,
    record: post.record,
  }
}

describe(Firehose, () => {
  it('reads events from firehose', async () => {
    await using pds = await StubPds.create()
    const runner = new MemoryRunner({ startCursor: pds.seq })
    const evtsPromise = readFirehose(pds, (evts) => evts.length >= 6, {
      runner,
    })

    const alice = await pds.createAccount('alice')
    const initCommit = alice.repo.cid
    const initRev = alice.repo.commit.rev
    const posts = [
      await pds.post(alice, 'one'),
      await pds.post(alice, 'two'),
      await pds.post(alice, 'three'),
    ]

    const evts = await evtsPromise
    expect(evts).toMatchObject([
      {
        event: 'identity',
        seq: 1,
        did: alice.did,
        handle: alice.handle,
        didDocument: { id: alice.did },
      },
      {
        event: 'account',
        seq: 2,
        did: alice.did,
        active: true,
        status: undefined,
      },
      {
        event: 'sync',
        seq: 3,
        did: alice.did,
        cid: initCommit,
        rev: initRev,
      },
      ...posts.map((post, i) => expectedCreate(post, 4 + i)),
    ])
  })

  it('does not naively pass through invalid handle evts', async () => {
    await using pds = await StubPds.create()
    const alice = await pds.createAccount('alice')
    const runner = new MemoryRunner({ startCursor: pds.seq })
    const evtsPromise = readFirehose(pds, (evts) => evts.length >= 1, {
      runner,
    })

    pds.emitIdentity(alice.did, 'bad-handle.test')

    const evts = await evtsPromise
    expect(evts).toMatchObject([
      { event: 'identity', did: alice.did, handle: alice.handle },
    ])
  })

  it('omits a handle that does not resolve back to the DID', async () => {
    await using pds = await StubPds.create()
    const alice = await pds.createAccount('alice')
    const bob = await pds.createAccount('bob')
    const runner = new MemoryRunner({ startCursor: pds.seq })
    const evtsPromise = readFirehose(pds, (evts) => evts.length >= 1, {
      runner,
    })

    // alice's handle resolves to alice's DID, not bob's
    pds.updateDidDocument(bob, { handle: alice.handle })
    pds.emitIdentity(bob.did, alice.handle)

    const evts = await evtsPromise
    expect(evts).toMatchObject([
      {
        event: 'identity',
        did: bob.did,
        handle: undefined,
        didDocument: { alsoKnownAs: [`at://${alice.handle}`] },
      },
    ])
  })

  it('rejects commits not signed by the key in the DID document', async () => {
    await using pds = await StubPds.create()
    const alice = await pds.createAccount('alice')
    const cursor = pds.seq
    await pds.post(alice, 'forged', {
      signingKey: await Secp256k1Keypair.create(),
    })
    const genuine = await pds.post(alice, 'genuine')

    const errors: Error[] = []
    const evts = await readFirehose(pds, (evts) => evts.length >= 1, {
      getCursor: () => cursor,
      onError: (err) => errors.push(err),
    })

    expect(evts).toMatchObject([expectedCreate(genuine, cursor + 2)])
    expect(errors).toHaveLength(1)
    const [err] = errors
    assert(err instanceof FirehoseParseError)
    expect(err.cause).toBeInstanceOf(RepoVerificationError)
    expect(err.event).toMatchObject({ seq: cursor + 1, repo: alice.did })
  })

  it('processes events through the sync queue', async () => {
    await using pds = await StubPds.create()
    const runner = new MemoryRunner({ startCursor: pds.seq })
    const userDids = new Set<DidString>()
    const evtsPromise = readFirehose(
      pds,
      (evts) =>
        userDids.size === 4 &&
        [...userDids].every(
          (did) => evts.filter((evt) => evt.did === did).length >= 6,
        ),
      { runner },
    )

    const createAndPost = async (name: string) => {
      const account = await pds.createAccount(name)
      userDids.add(account.did)
      const posts = [
        await pds.post(account, 'one'),
        await pds.post(account, 'two'),
        await pds.post(account, 'three'),
      ]
      return { did: account.did, posts }
    }
    const users = await Promise.all(
      ['user1', 'user2', 'user3', 'user4'].map(createAndPost),
    )

    const evts = await evtsPromise
    for (const { did, posts } of users) {
      const userEvts = evts.filter((evt) => evt.did === did)
      expect(userEvts.map((evt) => evt.event)).toEqual([
        'identity',
        'account',
        'sync',
        'create',
        'create',
        'create',
      ])
      expect(userEvts.slice(3)).toMatchObject(
        posts.map((post) => expectedCreate(post)),
      )
    }

    // The runner's cursor only advances past events that were all handled
    await runner.processAll()
    expect(runner.getCursor()).toBe(pds.seq)
  })
})
