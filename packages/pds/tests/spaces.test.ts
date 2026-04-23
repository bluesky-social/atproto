import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import { Client } from '@atproto/lex'
import { com } from '../src/lexicons/index.js'
import usersSeed from './seeds/users'

describe('spaces', () => {
  let network: TestNetworkNoAppView
  let client: Client
  let sc: SeedClient

  let aliceHeaders: { authorization: string }
  let bobHeaders: { authorization: string }

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'spaces',
    })
    client = network.pds.getClient()
    sc = network.getSeedClient()
    await usersSeed(sc)

    aliceHeaders = sc.getHeaders(sc.dids.alice)
    bobHeaders = sc.getHeaders(sc.dids.bob)
  })

  afterAll(async () => {
    await network.close()
  })

  let spaceUri: string

  it('creates a space', async () => {
    const res = await client.call(
      com.atproto.space.createSpace,
      {
        did: sc.dids.alice,
        type: 'app.bsky.group',
        skey: 'test',
      },
      { headers: aliceHeaders },
    )
    spaceUri = res.uri
    expect(spaceUri).toBe(`ats://${sc.dids.alice}/app.bsky.group/test`)
  })

  it('lists spaces', async () => {
    const res = await client.call(
      com.atproto.space.listSpaces,
      {},
      {
        headers: aliceHeaders,
      },
    )
    expect(res.spaces.length).toBe(1)
    expect(res.spaces[0].uri).toBe(spaceUri)
    expect(res.spaces[0].isOwner).toBe(true)
  })

  it('creates a record in a space', async () => {
    const record = {
      $type: 'app.bsky.feed.post',
      text: 'hello space',
      createdAt: new Date().toISOString(),
    }
    const created = await client.call(
      com.atproto.space.createRecord,
      {
        space: spaceUri,
        collection: 'app.bsky.feed.post',
        record,
      },
      { headers: aliceHeaders },
    )
    expect(created.uri).toBeDefined()
    expect(created.cid).toBeDefined()

    const rkey = created.uri.split('/').pop()!
    const got = await client.call(
      com.atproto.space.getRecord,
      {
        space: spaceUri,
        collection: 'app.bsky.feed.post',
        rkey,
      },
      { headers: aliceHeaders },
    )
    expect(got.value).toMatchObject({ text: 'hello space' })
  })

  it('lists records in a space', async () => {
    // add a couple more records
    for (let i = 0; i < 3; i++) {
      await client.call(
        com.atproto.space.createRecord,
        {
          space: spaceUri,
          collection: 'app.bsky.feed.post',
          record: {
            $type: 'app.bsky.feed.post',
            text: `post ${i}`,
            createdAt: new Date().toISOString(),
          },
        },
        { headers: aliceHeaders },
      )
    }

    const res = await client.call(
      com.atproto.space.listRecords,
      {
        space: spaceUri,
        collection: 'app.bsky.feed.post',
      },
      { headers: aliceHeaders },
    )
    expect(res.records.length).toBe(4) // 1 from earlier + 3 new
    for (const rec of res.records) {
      expect(rec.cid).toBeDefined()
      expect(rec.rkey).toBeDefined()
    }
  })

  it('adds a member to a space', async () => {
    await client.call(
      com.atproto.space.addMember,
      { space: spaceUri, did: sc.dids.bob },
      { headers: aliceHeaders },
    )
    const res = await client.call(
      com.atproto.space.listSpaces,
      {},
      { headers: bobHeaders },
    )
    expect(res.spaces.length).toBe(1)
    expect(res.spaces[0].uri).toBe(spaceUri)
    expect(res.spaces[0].isOwner).toBe(false)
  })

  it('non-owner cannot add members', async () => {
    const promise = client.call(
      com.atproto.space.addMember,
      { space: spaceUri, did: sc.dids.carol },
      { headers: bobHeaders },
    )
    await expect(promise).rejects.toThrow('Not the space owner')
  })

  it('removes a member from a space', async () => {
    await client.call(
      com.atproto.space.removeMember,
      { space: spaceUri, did: sc.dids.bob },
      { headers: aliceHeaders },
    )
    const res = await client.call(
      com.atproto.space.listSpaces,
      {},
      { headers: bobHeaders },
    )
    expect(res.spaces).toEqual([])
  })

  describe('oplog and state tracking', () => {
    let testSpaceUri: string

    beforeAll(async () => {
      const res = await client.call(
        com.atproto.space.createSpace,
        { did: sc.dids.alice, type: 'app.bsky.group', skey: 'oplog-test' },
        { headers: aliceHeaders },
      )
      testSpaceUri = res.uri
    })

    it('tracks oplog entries for record creates', async () => {
      await client.call(
        com.atproto.space.createRecord,
        {
          space: testSpaceUri,
          collection: 'app.bsky.feed.post',
          record: {
            $type: 'app.bsky.feed.post',
            text: 'oplog test',
            createdAt: new Date().toISOString(),
          },
        },
        { headers: aliceHeaders },
      )

      const result = await network.pds.ctx.actorStore.read(
        sc.dids.alice,
        (store) => store.space.getRepoOplog(testSpaceUri, {}),
      )
      expect(result.ops.length).toBeGreaterThan(0)
      const lastOp = result.ops[result.ops.length - 1]
      expect(lastOp.action).toBe('create')
      expect(lastOp.collection).toBe('app.bsky.feed.post')
    })

    it('tracks oplog entries for record deletes', async () => {
      const created = await client.call(
        com.atproto.space.createRecord,
        {
          space: testSpaceUri,
          collection: 'app.bsky.feed.post',
          record: {
            $type: 'app.bsky.feed.post',
            text: 'to be deleted',
            createdAt: new Date().toISOString(),
          },
        },
        { headers: aliceHeaders },
      )

      const rkey = created.uri.split('/').pop()!
      await client.call(
        com.atproto.space.deleteRecord,
        {
          space: testSpaceUri,
          collection: 'app.bsky.feed.post',
          rkey,
        },
        { headers: aliceHeaders },
      )

      const result = await network.pds.ctx.actorStore.read(
        sc.dids.alice,
        (store) => store.space.getRepoOplog(testSpaceUri, {}),
      )
      const deleteOp = result.ops.find((op) => op.action === 'delete')
      expect(deleteOp).toBeDefined()
      expect(deleteOp.collection).toBe('app.bsky.feed.post')
      expect(deleteOp.prev).toBeDefined()
    })

    it('tracks member oplog entries for member additions', async () => {
      await client.call(
        com.atproto.space.addMember,
        { space: testSpaceUri, did: sc.dids.bob },
        { headers: aliceHeaders },
      )

      const result = await network.pds.ctx.actorStore.read(
        sc.dids.alice,
        (store) => store.space.getMemberOplog(testSpaceUri, {}),
      )
      expect(result.ops.length).toBeGreaterThan(0)
      const addOp = result.ops.find(
        (op) => op.action === 'add' && op.did === sc.dids.bob,
      )
      expect(addOp).toBeDefined()
    })

    it('updates setHash after record writes', async () => {
      await client.call(
        com.atproto.space.createRecord,
        {
          space: testSpaceUri,
          collection: 'app.bsky.feed.post',
          record: {
            $type: 'app.bsky.feed.post',
            text: 'setHash test',
            createdAt: new Date().toISOString(),
          },
        },
        { headers: aliceHeaders },
      )

      const state = await network.pds.ctx.actorStore.read(
        sc.dids.alice,
        (store) => store.space.getRepoState(testSpaceUri),
      )
      expect(state.setHash).toBeDefined()
      expect(state.setHash).not.toBeNull()
      expect(state.rev).toBeDefined()
    })

    it('updates setHash after member changes', async () => {
      await client.call(
        com.atproto.space.addMember,
        { space: testSpaceUri, did: sc.dids.carol },
        { headers: aliceHeaders },
      )

      const state = await network.pds.ctx.actorStore.read(
        sc.dids.alice,
        (store) => store.space.getMemberState(testSpaceUri),
      )
      expect(state.setHash).toBeDefined()
      expect(state.setHash).not.toBeNull()
      expect(state.rev).toBeDefined()
    })

    it('produces multiple oplog entries with same rev but different idx in batch writes', async () => {
      const writes = [
        {
          $type: 'com.atproto.space.applyWrites#create',
          collection: 'app.bsky.feed.post',
          value: {
            $type: 'app.bsky.feed.post',
            text: 'batch post 1',
            createdAt: new Date().toISOString(),
          },
        },
        {
          $type: 'com.atproto.space.applyWrites#create',
          collection: 'app.bsky.feed.post',
          value: {
            $type: 'app.bsky.feed.post',
            text: 'batch post 2',
            createdAt: new Date().toISOString(),
          },
        },
        {
          $type: 'com.atproto.space.applyWrites#create',
          collection: 'app.bsky.feed.post',
          value: {
            $type: 'app.bsky.feed.post',
            text: 'batch post 3',
            createdAt: new Date().toISOString(),
          },
        },
      ]

      await client.call(
        com.atproto.space.applyWrites,
        { space: testSpaceUri, writes },
        { headers: aliceHeaders },
      )

      const result = await network.pds.ctx.actorStore.read(
        sc.dids.alice,
        (store) => store.space.getRepoOplog(testSpaceUri, {}),
      )

      // Get the last 3 ops (the batch)
      const batchOps = result.ops.slice(-3)
      expect(batchOps.length).toBe(3)

      // All should have the same rev
      const rev = batchOps[0].rev
      expect(batchOps[1].rev).toBe(rev)
      expect(batchOps[2].rev).toBe(rev)

      // But different idx: 0, 1, 2
      expect(batchOps[0].idx).toBe(0)
      expect(batchOps[1].idx).toBe(1)
      expect(batchOps[2].idx).toBe(2)
    })
  })

  describe('credential flow', () => {
    let credSpaceUri: string
    let credential: string

    beforeAll(async () => {
      const res = await client.call(
        com.atproto.space.createSpace,
        { did: sc.dids.alice, type: 'app.bsky.group', skey: 'cred-test' },
        { headers: aliceHeaders },
      )
      credSpaceUri = res.uri
      // Add bob as member
      await client.call(
        com.atproto.space.addMember,
        { space: credSpaceUri, did: sc.dids.bob },
        { headers: aliceHeaders },
      )
    })

    it('member obtains grant and exchanges for credential', async () => {
      const grantRes = await client.call(
        com.atproto.space.getMemberGrant,
        { space: credSpaceUri },
        { headers: bobHeaders },
      )
      expect(grantRes.grant).toBeDefined()

      const credRes = await client.call(
        com.atproto.space.getSpaceCredential,
        { space: credSpaceUri, grant: grantRes.grant },
      )
      expect(credRes.credential).toBeDefined()
      credential = credRes.credential
    })

    it('non-member grant is rejected', async () => {
      const carolHeaders = sc.getHeaders(sc.dids.carol)
      // Add carol, get grant, remove carol, try to exchange
      await client.call(
        com.atproto.space.addMember,
        { space: credSpaceUri, did: sc.dids.carol },
        { headers: aliceHeaders },
      )
      const grantRes = await client.call(
        com.atproto.space.getMemberGrant,
        { space: credSpaceUri },
        { headers: carolHeaders },
      )
      // Remove carol
      await client.call(
        com.atproto.space.removeMember,
        { space: credSpaceUri, did: sc.dids.carol },
        { headers: aliceHeaders },
      )
      // Try to exchange grant - should fail because carol is no longer a member
      await expect(
        client.call(com.atproto.space.getSpaceCredential, {
          space: credSpaceUri,
          grant: grantRes.grant,
        }),
      ).rejects.toThrow()
    })

    it('credential can be used for getRepoState', async () => {
      // Create a record to ensure there's state
      await client.call(
        com.atproto.space.createRecord,
        {
          space: credSpaceUri,
          collection: 'app.bsky.feed.post',
          record: {
            $type: 'app.bsky.feed.post',
            text: 'state test',
            createdAt: new Date().toISOString(),
          },
        },
        { headers: aliceHeaders },
      )

      const credHeaders = { authorization: `Bearer ${credential}` }
      const res = await client.call(
        com.atproto.space.getRepoState,
        { space: credSpaceUri, did: sc.dids.alice },
        { headers: credHeaders },
      )
      // Alice owns the space and has a repo state
      expect(res).toBeDefined()
      expect(res.setHash).toBeDefined()
      expect(res.rev).toBeDefined()
    })

    it('credential can be used for getMembers', async () => {
      const credHeaders = { authorization: `Bearer ${credential}` }
      const res = await client.call(
        com.atproto.space.getMembers,
        { space: credSpaceUri },
        { headers: credHeaders },
      )
      expect(res.members).toBeDefined()
      expect(res.members.length).toBeGreaterThan(0)
      const bobMember = res.members.find((m: any) => m.did === sc.dids.bob)
      expect(bobMember).toBeDefined()
    })
  })

  describe('sync flow', () => {
    let syncSpaceUri: string
    let syncCredential: string

    beforeAll(async () => {
      const res = await client.call(
        com.atproto.space.createSpace,
        { did: sc.dids.alice, type: 'app.bsky.group', skey: 'sync-test' },
        { headers: aliceHeaders },
      )
      syncSpaceUri = res.uri
      // Add bob and get credential
      await client.call(
        com.atproto.space.addMember,
        { space: syncSpaceUri, did: sc.dids.bob },
        { headers: aliceHeaders },
      )
      const grantRes = await client.call(
        com.atproto.space.getMemberGrant,
        { space: syncSpaceUri },
        { headers: bobHeaders },
      )
      const credRes = await client.call(
        com.atproto.space.getSpaceCredential,
        { space: syncSpaceUri, grant: grantRes.grant },
      )
      syncCredential = credRes.credential
    })

    it('syncs record operations via oplog', async () => {
      // Create some records
      for (let i = 0; i < 3; i++) {
        await client.call(
          com.atproto.space.createRecord,
          {
            space: syncSpaceUri,
            collection: 'app.bsky.feed.post',
            record: {
              $type: 'app.bsky.feed.post',
              text: `sync post ${i}`,
              createdAt: new Date().toISOString(),
            },
          },
          { headers: aliceHeaders },
        )
      }

      const credHeaders = { authorization: `Bearer ${syncCredential}` }
      const oplog = await client.call(
        com.atproto.space.getRepoOplog,
        { space: syncSpaceUri, did: sc.dids.alice },
        { headers: credHeaders },
      )
      expect(oplog.ops.length).toBe(3)
      for (const op of oplog.ops) {
        expect(op.action).toBe('create')
        expect(op.collection).toBe('app.bsky.feed.post')
      }
      expect(oplog.setHash).toBeDefined()
      expect(oplog.rev).toBeDefined()
    })

    it('supports incremental sync with since parameter', async () => {
      const credHeaders = { authorization: `Bearer ${syncCredential}` }

      // Get current state
      const state = await client.call(
        com.atproto.space.getRepoState,
        { space: syncSpaceUri, did: sc.dids.alice },
        { headers: credHeaders },
      )
      const sinceRev = state.rev

      // Create more records
      await client.call(
        com.atproto.space.createRecord,
        {
          space: syncSpaceUri,
          collection: 'app.bsky.feed.post',
          record: {
            $type: 'app.bsky.feed.post',
            text: 'new post',
            createdAt: new Date().toISOString(),
          },
        },
        { headers: aliceHeaders },
      )

      // Get oplog since last rev
      const oplog = await client.call(
        com.atproto.space.getRepoOplog,
        { space: syncSpaceUri, did: sc.dids.alice, since: sinceRev },
        { headers: credHeaders },
      )
      expect(oplog.ops.length).toBe(1)
      expect(oplog.ops[0].action).toBe('create')
    })

    it('syncs member list operations via member oplog', async () => {
      const credHeaders = { authorization: `Bearer ${syncCredential}` }
      const oplog = await client.call(
        com.atproto.space.getMemberOplog,
        { space: syncSpaceUri },
        { headers: credHeaders },
      )
      // Should have at least the add for bob
      expect(oplog.ops.length).toBeGreaterThan(0)
      const addBobOp = oplog.ops.find(
        (op: any) => op.did === sc.dids.bob && op.action === 'add',
      )
      expect(addBobOp).toBeDefined()
    })
  })
})
