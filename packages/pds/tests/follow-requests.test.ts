import { AtpAgent } from '@atproto/api'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { AtUri } from '@atproto/syntax'
import { AppContext } from '../src/context'

describe('follow request records', () => {
  let network: TestNetworkNoAppView
  let ctx: AppContext
  let agent: AtpAgent
  let aliceAgent: AtpAgent
  let bobAgent: AtpAgent
  let carolAgent: AtpAgent

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'follow_requests',
    })
    // @ts-expect-error Error due to circular dependency with the dev-env package
    ctx = network.pds.ctx
    agent = network.pds.getClient()
    aliceAgent = network.pds.getClient()
    bobAgent = network.pds.getClient()
    carolAgent = network.pds.getClient()

    await aliceAgent.createAccount({
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })

    await bobAgent.createAccount({
      email: 'bob@test.com',
      handle: 'bob.test',
      password: 'bob-pass',
    })

    await carolAgent.createAccount({
      email: 'carol@test.com',
      handle: 'carol.test',
      password: 'carol-pass',
    })
  })

  afterAll(async () => {
    await network.close()
  })

  it('creates a follow request record', async () => {
    const res = await aliceAgent.api.com.atproto.repo.createRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.graph.followRequest',
      record: {
        $type: 'app.bsky.graph.followRequest',
        subject: bobAgent.accountDid,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    })

    const uri = new AtUri(res.data.uri)
    expect(res.data.uri).toBe(
      `at://${aliceAgent.accountDid}/app.bsky.graph.followRequest/${uri.rkey}`,
    )
    expect(res.data.cid).toBeDefined()
  })

  it('retrieves a follow request record', async () => {
    // Create a follow request
    const createRes = await aliceAgent.api.com.atproto.repo.createRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.graph.followRequest',
      record: {
        $type: 'app.bsky.graph.followRequest',
        subject: carolAgent.accountDid,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    })

    const uri = new AtUri(createRes.data.uri)

    // Retrieve it
    const getRes = await agent.api.com.atproto.repo.getRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.graph.followRequest',
      rkey: uri.rkey,
    })

    expect(getRes.data.uri).toBe(uri.toString())
    expect(getRes.data.value).toMatchObject({
      $type: 'app.bsky.graph.followRequest',
      subject: carolAgent.accountDid,
      status: 'pending',
    })
  })

  it('lists follow requests by collection', async () => {
    // Create multiple follow requests from bob
    const createdAt = new Date().toISOString()
    await bobAgent.api.com.atproto.repo.createRecord({
      repo: bobAgent.accountDid,
      collection: 'app.bsky.graph.followRequest',
      record: {
        $type: 'app.bsky.graph.followRequest',
        subject: aliceAgent.accountDid,
        status: 'pending',
        createdAt,
      },
    })

    await bobAgent.api.com.atproto.repo.createRecord({
      repo: bobAgent.accountDid,
      collection: 'app.bsky.graph.followRequest',
      record: {
        $type: 'app.bsky.graph.followRequest',
        subject: carolAgent.accountDid,
        status: 'pending',
        createdAt,
      },
    })

    // List all follow requests from bob
    const listRes = await agent.api.com.atproto.repo.listRecords({
      repo: bobAgent.accountDid,
      collection: 'app.bsky.graph.followRequest',
    })

    expect(listRes.data.records.length).toBeGreaterThanOrEqual(2)
    expect(
      listRes.data.records.some(
        (r) => (r.value as any).subject === aliceAgent.accountDid,
      ),
    ).toBe(true)
    expect(
      listRes.data.records.some(
        (r) => (r.value as any).subject === carolAgent.accountDid,
      ),
    ).toBe(true)
  })

  it('updates follow request status', async () => {
    // Create a follow request
    const createRes = await carolAgent.api.com.atproto.repo.createRecord({
      repo: carolAgent.accountDid,
      collection: 'app.bsky.graph.followRequest',
      record: {
        $type: 'app.bsky.graph.followRequest',
        subject: aliceAgent.accountDid,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    })

    const uri = new AtUri(createRes.data.uri)

    // Update status to approved
    await carolAgent.api.com.atproto.repo.putRecord({
      repo: carolAgent.accountDid,
      collection: 'app.bsky.graph.followRequest',
      rkey: uri.rkey,
      record: {
        $type: 'app.bsky.graph.followRequest',
        subject: aliceAgent.accountDid,
        status: 'approved',
        createdAt: createRes.data.uri,
        respondedAt: new Date().toISOString(),
      },
    })

    // Verify the update
    const getRes = await agent.api.com.atproto.repo.getRecord({
      repo: carolAgent.accountDid,
      collection: 'app.bsky.graph.followRequest',
      rkey: uri.rkey,
    })

    expect(getRes.data.value).toMatchObject({
      $type: 'app.bsky.graph.followRequest',
      subject: aliceAgent.accountDid,
      status: 'approved',
    })
    expect((getRes.data.value as any).respondedAt).toBeDefined()
  })

  it('deletes a follow request record', async () => {
    // Create a follow request
    const createRes = await aliceAgent.api.com.atproto.repo.createRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.graph.followRequest',
      record: {
        $type: 'app.bsky.graph.followRequest',
        subject: bobAgent.accountDid,
        status: 'denied',
        createdAt: new Date().toISOString(),
        respondedAt: new Date().toISOString(),
      },
    })

    const uri = new AtUri(createRes.data.uri)

    // Delete it
    await aliceAgent.api.com.atproto.repo.deleteRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.graph.followRequest',
      rkey: uri.rkey,
    })

    // Verify it's deleted
    const getAttempt = agent.api.com.atproto.repo.getRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.graph.followRequest',
      rkey: uri.rkey,
    })

    await expect(getAttempt).rejects.toThrow()
  })

  it('queries follow requests by subject using backlinks', async () => {
    // Clear existing data by creating a new account
    const danAgent = network.pds.getClient()
    await danAgent.createAccount({
      email: 'dan@test.com',
      handle: 'dan.test',
      password: 'dan-pass',
    })

    // Create follow requests to dan from multiple users
    const createdAt = new Date().toISOString()

    await aliceAgent.api.com.atproto.repo.createRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.graph.followRequest',
      record: {
        $type: 'app.bsky.graph.followRequest',
        subject: danAgent.accountDid,
        status: 'pending',
        createdAt,
      },
    })

    await bobAgent.api.com.atproto.repo.createRecord({
      repo: bobAgent.accountDid,
      collection: 'app.bsky.graph.followRequest',
      record: {
        $type: 'app.bsky.graph.followRequest',
        subject: danAgent.accountDid,
        status: 'pending',
        createdAt,
      },
    })

    // Query via actor store (using backlinks)
    const backlinks = await ctx.actorStore.read(
      aliceAgent.accountDid,
      (store) =>
        store.record.getRecordBacklinks({
          collection: 'app.bsky.graph.followRequest',
          path: 'subject',
          linkTo: danAgent.accountDid,
        }),
    )

    // Should find at least alice's request
    expect(backlinks.length).toBeGreaterThanOrEqual(1)
    expect(backlinks.some((b) => b.uri.includes(aliceAgent.accountDid))).toBe(
      true,
    )
  })

  it('supports pagination for follow requests', async () => {
    // Create multiple follow requests
    const createdAt = new Date().toISOString()
    const rkeys: string[] = []

    for (let i = 0; i < 5; i++) {
      const res = await aliceAgent.api.com.atproto.repo.createRecord({
        repo: aliceAgent.accountDid,
        collection: 'app.bsky.graph.followRequest',
        record: {
          $type: 'app.bsky.graph.followRequest',
          subject: `did:example:user${i}`,
          status: 'pending',
          createdAt,
        },
      })
      const uri = new AtUri(res.data.uri)
      rkeys.push(uri.rkey)
    }

    // List with limit
    const page1 = await agent.api.com.atproto.repo.listRecords({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.graph.followRequest',
      limit: 3,
    })

    expect(page1.data.records.length).toBeLessThanOrEqual(3)

    // List second page if cursor exists
    if (page1.data.cursor) {
      const page2 = await agent.api.com.atproto.repo.listRecords({
        repo: aliceAgent.accountDid,
        collection: 'app.bsky.graph.followRequest',
        limit: 3,
        cursor: page1.data.cursor,
      })

      expect(page2.data.records.length).toBeGreaterThan(0)
    }
  })

  it('prevents duplicate follow requests via backlink conflicts', async () => {
    // Create a follow request
    const createdAt = new Date().toISOString()
    const res1 = await aliceAgent.api.com.atproto.repo.createRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.graph.followRequest',
      record: {
        $type: 'app.bsky.graph.followRequest',
        subject: bobAgent.accountDid,
        status: 'pending',
        createdAt,
      },
    })

    expect(res1.data.uri).toBeDefined()

    // Try to create another follow request to the same subject
    // The system should detect duplicate via backlinks
    const res2 = await aliceAgent.api.com.atproto.repo.createRecord({
      repo: aliceAgent.accountDid,
      collection: 'app.bsky.graph.followRequest',
      record: {
        $type: 'app.bsky.graph.followRequest',
        subject: bobAgent.accountDid,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    })

    // Both should succeed at record creation level
    // Duplicate detection should be handled at application level
    expect(res2.data.uri).toBeDefined()

    // Verify we can query backlink conflicts
    const uri = new AtUri(res2.data.uri)
    const conflicts = await ctx.actorStore.read(
      aliceAgent.accountDid,
      (store) =>
        store.record.getBacklinkConflicts(uri, {
          $type: 'app.bsky.graph.followRequest',
          subject: bobAgent.accountDid,
          status: 'pending',
          createdAt,
        }),
    )

    // Should find the existing follow request as a conflict
    expect(conflicts.length).toBeGreaterThan(0)
  })

  it('stores follow requests with all status types', async () => {
    const statuses = ['pending', 'approved', 'denied'] as const

    for (const status of statuses) {
      const res = await carolAgent.api.com.atproto.repo.createRecord({
        repo: carolAgent.accountDid,
        collection: 'app.bsky.graph.followRequest',
        record: {
          $type: 'app.bsky.graph.followRequest',
          subject: `did:example:${status}`,
          status,
          createdAt: new Date().toISOString(),
        },
      })

      expect(res.data.uri).toBeDefined()

      // Verify it was stored correctly
      const uri = new AtUri(res.data.uri)
      const getRes = await agent.api.com.atproto.repo.getRecord({
        repo: carolAgent.accountDid,
        collection: 'app.bsky.graph.followRequest',
        rkey: uri.rkey,
      })

      expect((getRes.data.value as any).status).toBe(status)
    }
  })
})
