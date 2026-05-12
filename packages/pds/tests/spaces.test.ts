import { SeedClient, TestNetworkNoAppView, TestPds } from '@atproto/dev-env'
import { Client, DidString, xrpc } from '@atproto/lex'
import { SetHash } from '@atproto/space'
import { NsidString, SpaceUriString } from '@atproto/syntax'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import { com } from '../src/lexicons/index.js'

// Spaces tests run against a 3-PDS network:
//   pds1: alice (owner), dan (co-located member)
//   pds2: bob  (remote member)
//   pds3: carol (not a member by default; joins where needed)
// Any test can reach into any PDS; most use one or two. Tests create a
// dedicated space per-test (distinct skey) so they don't order-depend on each
// other.
describe('spaces', () => {
  let network: TestNetworkNoAppView
  let pds1: TestPds
  let pds2: TestPds
  let pds3: TestPds
  let pds1Client: Client
  let pds2Client: Client
  let pds3Client: Client

  let aliceDid: DidString
  let danDid: DidString
  let bobDid: DidString
  let carolDid: DidString
  let aliceHeaders: { authorization: string }
  let danHeaders: { authorization: string }
  let bobHeaders: { authorization: string }
  let carolHeaders: { authorization: string }

  const createAccountOn = async (
    pds: TestPds,
    { handle, email }: { handle: string; email: string },
  ): Promise<{ did: DidString; headers: { authorization: string } }> => {
    const agent = pds.getAgent()
    const res = await agent.com.atproto.server.createAccount({
      handle,
      email,
      password: `${handle}-pass`,
    })
    return {
      did: res.data.did as DidString,
      headers: SeedClient.getHeaders(res.data.accessJwt),
    }
  }

  const createSpace = async (
    skey: string,
    members: DidString[] = [],
  ): Promise<SpaceUriString> => {
    const res = await pds1Client.call(
      com.atproto.space.createSpace,
      { did: aliceDid, type: 'app.bsky.group' as NsidString, skey },
      { headers: aliceHeaders },
    )
    const uri = res.uri as SpaceUriString
    for (const did of members) {
      await pds1Client.call(
        com.atproto.space.addMember,
        { space: uri, did },
        { headers: aliceHeaders },
      )
    }
    return uri
  }

  // Issues a fresh space credential for `memberPds`-hosted member.
  const credentialFor = async (
    memberPds: TestPds,
    memberHeaders: { authorization: string },
    space: SpaceUriString,
  ): Promise<{ authorization: string }> => {
    const memberClient = memberPds.getClient()
    const grantRes = await memberClient.call(
      com.atproto.space.getMemberGrant,
      { space },
      { headers: memberHeaders },
    )
    const credRes = await pds1Client.call(
      com.atproto.space.getSpaceCredential,
      {
        space,
        grant: grantRes.grant,
      },
    )
    return { authorization: `Bearer ${credRes.credential}` }
  }

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'spaces',
      extraPdses: 2,
    })
    pds1 = network.pds
    pds2 = network.extraPdses[0]
    pds3 = network.extraPdses[1]
    pds1Client = pds1.getClient()
    pds2Client = pds2.getClient()
    pds3Client = pds3.getClient()

    const alice = await createAccountOn(pds1, {
      handle: 'alice.test',
      email: 'alice@test.com',
    })
    const dan = await createAccountOn(pds1, {
      handle: 'dan.test',
      email: 'dan@test.com',
    })
    const bob = await createAccountOn(pds2, {
      handle: 'bob.test2',
      email: 'bob@test.com',
    })
    const carol = await createAccountOn(pds3, {
      handle: 'carol.test3',
      email: 'carol@test.com',
    })
    aliceDid = alice.did
    danDid = dan.did
    bobDid = bob.did
    carolDid = carol.did
    aliceHeaders = alice.headers
    danHeaders = dan.headers
    bobHeaders = bob.headers
    carolHeaders = carol.headers
  })

  afterAll(async () => {
    await network.close()
  })

  // ---------------- Lifecycle ----------------

  it('creates a space', async () => {
    const spaceUri = await createSpace('create')
    expect(spaceUri).toBe(`ats://${aliceDid}/app.bsky.group/create`)

    const res = await pds1Client.call(
      com.atproto.space.listSpaces,
      {},
      { headers: aliceHeaders },
    )
    const match = res.spaces.find((s) => s.uri === spaceUri)
    expect(match).toMatchObject({ uri: spaceUri, isOwner: true })
  })

  it('adds and removes members', async () => {
    const spaceUri = await createSpace('membership', [danDid])

    // Dan is a member but not the owner — addMember must refuse.
    await expect(
      pds1Client.call(
        com.atproto.space.addMember,
        { space: spaceUri, did: carolDid },
        { headers: danHeaders },
      ),
    ).rejects.toThrow('Not the space owner')

    // State before any membership changes — setHash/rev should exist but the
    // owner-is-a-member add at space-creation time is the only entry so far.
    const before = await pds1.ctx.actorStore.read(aliceDid, (store) =>
      store.space.getMemberState(spaceUri),
    )

    await pds1Client.call(
      com.atproto.space.addMember,
      { space: spaceUri, did: bobDid },
      { headers: aliceHeaders },
    )

    // Bob's PDS sees the space as a non-owner membership.
    const bobList = await pds2Client.call(
      com.atproto.space.listSpaces,
      {},
      { headers: bobHeaders },
    )
    expect(bobList.spaces.find((s) => s.uri === spaceUri)).toMatchObject({
      uri: spaceUri,
      isOwner: false,
    })

    const addedOplog = await pds1.ctx.actorStore.read(aliceDid, (store) =>
      store.space.getMemberOplog(spaceUri, {}),
    )
    const addOp = addedOplog.ops.find(
      (op) => op.action === 'add' && op.did === bobDid,
    )
    expect(addOp).toBeDefined()

    const after = await pds1.ctx.actorStore.read(aliceDid, (store) =>
      store.space.getMemberState(spaceUri),
    )
    expect(after!.rev).not.toEqual(before!.rev)
    expect(after!.setHash).not.toEqual(before!.setHash)

    // Remove and confirm the membership disappears from bob's view.
    await pds1Client.call(
      com.atproto.space.removeMember,
      { space: spaceUri, did: bobDid },
      { headers: aliceHeaders },
    )
    const bobListAfter = await pds2Client.call(
      com.atproto.space.listSpaces,
      {},
      { headers: bobHeaders },
    )
    expect(bobListAfter.spaces.find((s) => s.uri === spaceUri)).toBeUndefined()
  })

  // ---------------- Writes & reads ----------------

  it('writes a record as a co-located member', async () => {
    // Dan is co-located with the owner on pds1 — pure single-PDS write path.
    const spaceUri = await createSpace('single-pds-write', [danDid])

    const before = await pds1.ctx.actorStore.read(danDid, (store) =>
      store.space.getRepoState(spaceUri),
    )

    const created = await pds1Client.call(
      com.atproto.space.createRecord,
      {
        space: spaceUri,
        collection: 'app.bsky.feed.post',
        record: {
          $type: 'app.bsky.feed.post',
          text: 'hello from dan',
          createdAt: new Date().toISOString(),
        },
      },
      { headers: danHeaders },
    )
    expect(created.uri).toContain(danDid)

    const rkey = created.uri.split('/').pop()!
    const got = await pds1Client.call(
      com.atproto.space.getRecord,
      { space: spaceUri, collection: 'app.bsky.feed.post', rkey },
      { headers: danHeaders },
    )
    expect(got.value).toMatchObject({ text: 'hello from dan' })

    const oplog = await pds1.ctx.actorStore.read(danDid, (store) =>
      store.space.getRepoOplog(spaceUri, {}),
    )
    const lastOp = oplog.ops[oplog.ops.length - 1]
    expect(lastOp).toMatchObject({
      action: 'create',
      collection: 'app.bsky.feed.post',
      rkey,
    })

    const after = await pds1.ctx.actorStore.read(danDid, (store) =>
      store.space.getRepoState(spaceUri),
    )
    expect(after!.rev).not.toEqual(before?.rev ?? null)
    expect(after!.setHash).not.toEqual(before?.setHash ?? null)
  })

  it('deletes a record', async () => {
    const spaceUri = await createSpace('deletes', [danDid])

    const created = await pds1Client.call(
      com.atproto.space.createRecord,
      {
        space: spaceUri,
        collection: 'app.bsky.feed.post',
        record: {
          $type: 'app.bsky.feed.post',
          text: 'to be deleted',
          createdAt: new Date().toISOString(),
        },
      },
      { headers: danHeaders },
    )
    const rkey = created.uri.split('/').pop()!

    await pds1Client.call(
      com.atproto.space.deleteRecord,
      { space: spaceUri, collection: 'app.bsky.feed.post', rkey },
      { headers: danHeaders },
    )

    const oplog = await pds1.ctx.actorStore.read(danDid, (store) =>
      store.space.getRepoOplog(spaceUri, {}),
    )
    const deleteOp = oplog.ops.find((op) => op.action === 'delete')
    expect(deleteOp).toMatchObject({
      collection: 'app.bsky.feed.post',
      rkey,
      cid: null,
    })
    expect(deleteOp!.prev).toBe(created.cid)
  })

  it('applies a batch of writes', async () => {
    const spaceUri = await createSpace('batch', [danDid])

    const writes = [0, 1, 2].map(
      (i) =>
        ({
          $type: 'com.atproto.space.applyWrites#create' as const,
          collection: 'app.bsky.feed.post' as NsidString,
          value: {
            $type: 'app.bsky.feed.post',
            text: `batch ${i}`,
            createdAt: new Date().toISOString(),
          },
        }) as const,
    )

    await pds1Client.call(
      com.atproto.space.applyWrites,
      { space: spaceUri, writes },
      { headers: danHeaders },
    )

    const oplog = await pds1.ctx.actorStore.read(danDid, (store) =>
      store.space.getRepoOplog(spaceUri, {}),
    )
    const batchOps = oplog.ops.slice(-3)
    expect(batchOps.map((o) => o.rev)).toEqual([
      batchOps[0].rev,
      batchOps[0].rev,
      batchOps[0].rev,
    ])
    expect(batchOps.map((o) => o.idx)).toEqual([0, 1, 2])
  })

  // ---------------- Cross-PDS ----------------

  it('writes a record from a remote PDS', async () => {
    // Story: bob (pds2) writes. The owner PDS will receive a notifyWrite
    // fire-and-forget, but the authoritative path is the oplog on bob's PDS.
    const spaceUri = await createSpace('remote-write', [bobDid])

    const created = await pds2Client.call(
      com.atproto.space.createRecord,
      {
        space: spaceUri,
        collection: 'app.bsky.feed.post',
        record: {
          $type: 'app.bsky.feed.post',
          text: 'hello from bob',
          createdAt: new Date().toISOString(),
        },
      },
      { headers: bobHeaders },
    )
    expect(created.uri).toContain(bobDid)

    const oplog = await pds2.ctx.actorStore.read(bobDid, (store) =>
      store.space.getRepoOplog(spaceUri, {}),
    )
    const lastOp = oplog.ops[oplog.ops.length - 1]
    expect(lastOp.action).toBe('create')
    expect(lastOp.cid).toBe(created.cid)
  })

  it('reads a member repo with a space credential', async () => {
    const spaceUri = await createSpace('cred-read', [bobDid, carolDid])

    // Bob writes on pds2.
    await pds2Client.call(
      com.atproto.space.createRecord,
      {
        space: spaceUri,
        collection: 'app.bsky.feed.post',
        record: {
          $type: 'app.bsky.feed.post',
          text: 'for the record',
          createdAt: new Date().toISOString(),
        },
      },
      { headers: bobHeaders },
    )

    // Carol (pds3) exchanges her grant for a credential and uses it to read
    // bob's repo on pds2.
    const credHeaders = await credentialFor(pds3, carolHeaders, spaceUri)

    const list = await pds2Client.call(
      com.atproto.space.listRecords,
      { space: spaceUri, repo: bobDid, collection: 'app.bsky.feed.post' },
      { headers: credHeaders },
    )
    expect(list.records.length).toBe(1)

    const rec = await pds2Client.call(
      com.atproto.space.getRecord,
      {
        space: spaceUri,
        repo: bobDid,
        collection: 'app.bsky.feed.post',
        rkey: list.records[0].rkey,
      },
      { headers: credHeaders },
    )
    expect(rec.value).toMatchObject({ text: 'for the record' })
  })

  it('paginates listRecords across collections', async () => {
    const spaceUri = await createSpace('list-multi-collection', [danDid])

    // Two records in two different collections.
    const collections: NsidString[] = [
      'app.bsky.feed.post' as NsidString,
      'app.bsky.feed.like' as NsidString,
    ]
    for (const collection of collections) {
      await pds1Client.call(
        com.atproto.space.createRecord,
        {
          space: spaceUri,
          collection,
          record:
            collection === 'app.bsky.feed.post'
              ? {
                  $type: 'app.bsky.feed.post',
                  text: 'post',
                  createdAt: new Date().toISOString(),
                }
              : {
                  $type: 'app.bsky.feed.like',
                  subject: {
                    uri: `at://${danDid}/app.bsky.feed.post/self`,
                    cid: 'bafyreib2rxk3rybk3aobmv5cjuql3bm2twh4jo5uxgf5zpaw6odwtgdgzy',
                  },
                  createdAt: new Date().toISOString(),
                },
        },
        { headers: danHeaders },
      )
    }

    // Two pages of one record each; the cursor must span collections.
    const first = await pds1Client.call(
      com.atproto.space.listRecords,
      { space: spaceUri, limit: 1 },
      { headers: danHeaders },
    )
    expect(first.records.length).toBe(1)
    expect(first.cursor).toBeDefined()

    const second = await pds1Client.call(
      com.atproto.space.listRecords,
      { space: spaceUri, limit: 1, cursor: first.cursor },
      { headers: danHeaders },
    )
    expect(second.records.length).toBe(1)
    expect(second.records[0].collection).not.toBe(first.records[0].collection)

    const third = await pds1Client.call(
      com.atproto.space.listRecords,
      { space: spaceUri, limit: 1, cursor: second.cursor },
      { headers: danHeaders },
    )
    expect(third.records).toEqual([])
  })

  // ---------------- Credential issuance ----------------

  it('rejects a grant from a revoked member', async () => {
    const spaceUri = await createSpace('cred-revoke', [carolDid])

    // Carol fetches a grant while she's a member.
    const grantRes = await pds3Client.call(
      com.atproto.space.getMemberGrant,
      { space: spaceUri },
      { headers: carolHeaders },
    )

    // Alice removes her before she can redeem.
    await pds1Client.call(
      com.atproto.space.removeMember,
      { space: spaceUri, did: carolDid },
      { headers: aliceHeaders },
    )

    await expect(
      pds1Client.call(com.atproto.space.getSpaceCredential, {
        space: spaceUri,
        grant: grantRes.grant,
      }),
    ).rejects.toThrow()
  })

  it('scopes a credential to one space', async () => {
    // Carol is a member of one space; she can read it, not a sibling space.
    const targetSpace = await createSpace('cred-target', [carolDid])
    const otherSpace = await createSpace('cred-other', [])

    const credHeaders = await credentialFor(pds3, carolHeaders, targetSpace)

    const ok = await pds1Client.call(
      com.atproto.space.getRepoState,
      { space: targetSpace, did: aliceDid },
      { headers: credHeaders },
    )
    expect(ok).toBeDefined()

    await expect(
      pds1Client.call(
        com.atproto.space.getRepoOplog,
        { space: otherSpace, did: aliceDid },
        { headers: credHeaders },
      ),
    ).rejects.toThrow()
  })

  // ---------------- Sync recovery ----------------

  it('recovers from a pruned oplog via listRecords', async () => {
    // Tells the full-resync story: when the oplog no longer reaches back to
    // a consumer's cursor, an incremental pull yields an incomplete diff,
    // which is detectable via setHash mismatch. Recovery uses listRecords +
    // getRepoState — no new endpoint needed.
    const spaceUri = await createSpace('prune', [bobDid])

    const writePost = (text: string) =>
      pds2Client.call(
        com.atproto.space.createRecord,
        {
          space: spaceUri,
          collection: 'app.bsky.feed.post',
          record: {
            $type: 'app.bsky.feed.post',
            text,
            createdAt: new Date().toISOString(),
          },
        },
        { headers: bobHeaders },
      )

    // Phase 1: three writes the consumer "sees".
    await writePost('pre-prune 1')
    await writePost('pre-prune 2')
    await writePost('pre-prune 3')

    const stateBeforePrune = await pds2.ctx.actorStore.read(bobDid, (store) =>
      store.space.getRepoState(spaceUri),
    )
    const consumerSince = stateBeforePrune!.rev!

    // Phase 2: two more writes after the consumer's cursor.
    await writePost('post-prune 1')
    await writePost('post-prune 2')

    // Simulate retention by deleting oplog rows at/below the cursor. Reach
    // in via the SpaceTransactor (its ActorDb handle is public) since the
    // outer ActorStoreTransactor keeps its db protected.
    await pds2.ctx.actorStore.transact(bobDid, async (txn) => {
      await txn.space.db.db
        .deleteFrom('space_record_oplog')
        .where('space', '=', spaceUri)
        .where('rev', '<=', consumerSince)
        .execute()
    })

    // Incremental pull returns only the post-prune ops; applying them alone
    // yields a setHash that diverges from the server's.
    const incremental = await pds2.ctx.actorStore.read(bobDid, (store) =>
      store.space.getRepoOplog(spaceUri, { since: consumerSince }),
    )
    expect(incremental.ops.length).toBe(2)

    const applied = new SetHash()
    for (const op of incremental.ops) {
      if (op.cid && (op.action === 'create' || op.action === 'update')) {
        await applied.add(`${op.collection}/${op.rkey}:${op.cid}`)
      }
    }
    expect(applied.equals(new SetHash(incremental.setHash!))).toBe(false)

    // Recovery: paginated listRecords across all collections → recompute.
    const allRecords: { collection: string; rkey: string; cid: string }[] = []
    let cursor: string | undefined
    for (let page = 0; page < 10; page++) {
      const res = await pds2.ctx.actorStore.read(bobDid, (store) =>
        store.space.listRecords(spaceUri, { limit: 2, cursor }),
      )
      if (res.length === 0) break
      allRecords.push(...res)
      cursor = `${res[res.length - 1].collection}/${res[res.length - 1].rkey}`
      if (res.length < 2) break
    }
    expect(allRecords.length).toBe(5)

    const recomputed = new SetHash()
    for (const r of allRecords) {
      await recomputed.add(`${r.collection}/${r.rkey}:${r.cid}`)
    }
    const repoState = await pds2.ctx.actorStore.read(bobDid, (store) =>
      store.space.getRepoState(spaceUri),
    )
    expect(recomputed.equals(new SetHash(repoState!.setHash!))).toBe(true)
  })

  // ---------------- Adversarial ----------------

  it('rejects a notifyWrite that spoofs the writer', async () => {
    // Bob (pds2, member) signs a notifyWrite but claims carol wrote. Owner
    // must refuse based on iss ≠ body.did.
    const spaceUri = await createSpace('spoof-iss', [bobDid, carolDid])

    const keypair = await pds2.ctx.actorStore.keypair(bobDid)
    const { headers } = await createServiceAuthHeaders({
      iss: bobDid,
      aud: aliceDid,
      lxm: com.atproto.space.notifyWrite.$lxm,
      keypair,
    })
    await expect(
      xrpc(pds1.url, com.atproto.space.notifyWrite, {
        headers,
        body: {
          space: spaceUri as any,
          did: carolDid as any,
          rev: 'spoof',
        },
      }),
    ).rejects.toThrow()
  })

  it('rejects a notifyWrite from a non-member', async () => {
    // iss === body.did, but the signer isn't in the member list.
    const spaceUri = await createSpace('spoof-nonmember', [bobDid])

    const keypair = await pds3.ctx.actorStore.keypair(carolDid)
    const { headers } = await createServiceAuthHeaders({
      iss: carolDid,
      aud: aliceDid,
      lxm: com.atproto.space.notifyWrite.$lxm,
      keypair,
    })
    await expect(
      xrpc(pds1.url, com.atproto.space.notifyWrite, {
        headers,
        body: {
          space: spaceUri as any,
          did: carolDid as any,
          rev: 'spoof',
        },
      }),
    ).rejects.toThrow()
  })
})
