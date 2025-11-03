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

describe('follow request endpoints', () => {
  // Reuse the same network, ctx, and agents from the parent scope
  // The agents were already created in the first beforeAll block

  describe('createFollowRequest', () => {
    beforeAll(async () => {
      // Make Bob's profile private for endpoint tests
      await bobAgent.api.app.bsky.actor.setPrivacySettings({
        isPrivate: true,
      })
    })

    it('creates a follow request to a private profile', async () => {
      const res = await aliceAgent.api.app.bsky.graph.createFollowRequest({
        subject: bobAgent.accountDid,
      })

      expect(res.data.uri).toBeDefined()
      expect(res.data.cid).toBeDefined()
      expect(res.data.uri).toContain(aliceAgent.accountDid)
      expect(res.data.uri).toContain('app.bsky.graph.followRequest')
    })

    it('fails when profile is not private', async () => {
      // Alice's profile is public
      await expect(
        bobAgent.api.app.bsky.graph.createFollowRequest({
          subject: aliceAgent.accountDid,
        }),
      ).rejects.toThrow(/not private/i)
    })

    it('prevents duplicate follow requests', async () => {
      // Carol creates first request to Bob
      await carolAgent.api.app.bsky.graph.createFollowRequest({
        subject: bobAgent.accountDid,
      })

      // Try to create another one
      await expect(
        carolAgent.api.app.bsky.graph.createFollowRequest({
          subject: bobAgent.accountDid,
        }),
      ).rejects.toThrow(/duplicate/i)
    })

    it('fails for non-existent subject', async () => {
      await expect(
        aliceAgent.api.app.bsky.graph.createFollowRequest({
          subject: 'did:plc:nonexistent',
        }),
      ).rejects.toThrow(/not found/i)
    })

    it('requires authentication', async () => {
      const unauthAgent = network.pds.getClient()

      await expect(
        unauthAgent.api.app.bsky.graph.createFollowRequest({
          subject: bobAgent.accountDid,
        }),
      ).rejects.toThrow()
    })
  })

  describe('listFollowRequests', () => {
    beforeAll(async () => {
      // Clean slate - make Dan's profile private
      const danAgent = network.pds.getClient()
      await danAgent.createAccount({
        email: 'dan@test.com',
        handle: 'dan.test',
        password: 'dan-pass',
      })

      await danAgent.api.app.bsky.actor.setPrivacySettings({
        isPrivate: true,
      })

      // Create follow requests to Dan
      await aliceAgent.api.app.bsky.graph.createFollowRequest({
        subject: danAgent.accountDid,
      })

      await bobAgent.api.app.bsky.graph.createFollowRequest({
        subject: danAgent.accountDid,
      })
    })

    it('lists incoming follow requests', async () => {
      const danAgent = network.pds.getClient()
      await danAgent.login({
        identifier: 'dan.test',
        password: 'dan-pass',
      })

      const res = await danAgent.api.app.bsky.graph.listFollowRequests({
        direction: 'incoming',
      })

      expect(res.data.requests.length).toBeGreaterThanOrEqual(2)
      expect(
        res.data.requests.some(
          (r) => r.requester.did === aliceAgent.accountDid,
        ),
      ).toBe(true)
      expect(
        res.data.requests.some((r) => r.requester.did === bobAgent.accountDid),
      ).toBe(true)
    })

    it('lists outgoing follow requests', async () => {
      const res = await aliceAgent.api.app.bsky.graph.listFollowRequests({
        direction: 'outgoing',
      })

      expect(res.data.requests.length).toBeGreaterThanOrEqual(1)
      expect(res.data.requests.every((r) => r.status === 'pending')).toBe(true)
    })

    it('filters by status', async () => {
      const res = await aliceAgent.api.app.bsky.graph.listFollowRequests({
        direction: 'outgoing',
        status: 'pending',
      })

      expect(res.data.requests.every((r) => r.status === 'pending')).toBe(true)
    })

    it('supports pagination', async () => {
      const res = await aliceAgent.api.app.bsky.graph.listFollowRequests({
        direction: 'outgoing',
        limit: 1,
      })

      expect(res.data.requests.length).toBeLessThanOrEqual(1)
      if (res.data.cursor) {
        const page2 = await aliceAgent.api.app.bsky.graph.listFollowRequests({
          direction: 'outgoing',
          limit: 1,
          cursor: res.data.cursor,
        })
        expect(page2.data.requests.length).toBeGreaterThan(0)
      }
    })

    it('enriches with profile data', async () => {
      const danAgent = network.pds.getClient()
      await danAgent.login({
        identifier: 'dan.test',
        password: 'dan-pass',
      })

      const res = await danAgent.api.app.bsky.graph.listFollowRequests({
        direction: 'incoming',
      })

      expect(res.data.requests.length).toBeGreaterThan(0)
      const request = res.data.requests[0]
      expect(request.requester.did).toBeDefined()
      expect(request.requester.handle).toBeDefined()
      // Handle should not be the same as DID (should be resolved)
      expect(request.requester.handle).not.toBe(request.requester.did)
    })

    it('requires authentication', async () => {
      const unauthAgent = network.pds.getClient()

      await expect(
        unauthAgent.api.app.bsky.graph.listFollowRequests(),
      ).rejects.toThrow()
    })
  })

  describe('respondToFollowRequest', () => {
    let eveAgent: AtpAgent
    let frankAgent: AtpAgent
    let requestUri: string

    beforeAll(async () => {
      eveAgent = network.pds.getClient()
      frankAgent = network.pds.getClient()

      await eveAgent.createAccount({
        email: 'eve@test.com',
        handle: 'eve.test',
        password: 'eve-pass',
      })

      await frankAgent.createAccount({
        email: 'frank@test.com',
        handle: 'frank.test',
        password: 'frank-pass',
      })

      // Make Frank's profile private
      await frankAgent.api.app.bsky.actor.setPrivacySettings({
        isPrivate: true,
      })

      // Eve requests to follow Frank
      const createRes = await eveAgent.api.app.bsky.graph.createFollowRequest({
        subject: frankAgent.accountDid,
      })
      requestUri = createRes.data.uri
    })

    it('approves a follow request', async () => {
      const res = await frankAgent.api.app.bsky.graph.respondToFollowRequest({
        requestUri,
        response: 'approve',
      })

      expect(res.data.request.uri).toBe(requestUri)
      expect(res.data.followRecord).toBeDefined()
      expect(res.data.followRecord?.uri).toContain('app.bsky.graph.follow')
    })

    it('creates follow record on approval', async () => {
      // Create new request for testing
      const graceAgent = network.pds.getClient()
      await graceAgent.createAccount({
        email: 'grace@test.com',
        handle: 'grace.test',
        password: 'grace-pass',
      })

      const createRes = await graceAgent.api.app.bsky.graph.createFollowRequest(
        {
          subject: frankAgent.accountDid,
        },
      )

      const approveRes =
        await frankAgent.api.app.bsky.graph.respondToFollowRequest({
          requestUri: createRes.data.uri,
          response: 'approve',
        })

      // Verify follow record exists
      expect(approveRes.data.followRecord).toBeDefined()
      const followUri = approveRes.data.followRecord!.uri

      // Should be able to get the follow record
      const parts = followUri.split('/')
      const followRecord = await agent.api.com.atproto.repo.getRecord({
        repo: parts[2],
        collection: 'app.bsky.graph.follow',
        rkey: parts[4],
      })

      expect(followRecord.data.value).toMatchObject({
        $type: 'app.bsky.graph.follow',
        subject: frankAgent.accountDid,
      })
    })

    it('denies a follow request', async () => {
      // Create new request
      const harryAgent = network.pds.getClient()
      await harryAgent.createAccount({
        email: 'harry@test.com',
        handle: 'harry.test',
        password: 'harry-pass',
      })

      const createRes = await harryAgent.api.app.bsky.graph.createFollowRequest(
        {
          subject: frankAgent.accountDid,
        },
      )

      const res = await frankAgent.api.app.bsky.graph.respondToFollowRequest({
        requestUri: createRes.data.uri,
        response: 'deny',
      })

      expect(res.data.request.uri).toBe(createRes.data.uri)
      expect(res.data.followRecord).toBeUndefined()
    })

    it('fails for non-existent request', async () => {
      await expect(
        frankAgent.api.app.bsky.graph.respondToFollowRequest({
          requestUri: `at://${frankAgent.accountDid}/app.bsky.graph.followRequest/nonexistent`,
          response: 'approve',
        }),
      ).rejects.toThrow(/not found/i)
    })

    it('fails when not authorized', async () => {
      // Alice tries to respond to a request meant for Frank
      const isabelAgent = network.pds.getClient()
      await isabelAgent.createAccount({
        email: 'isabel@test.com',
        handle: 'isabel.test',
        password: 'isabel-pass',
      })

      const createRes =
        await isabelAgent.api.app.bsky.graph.createFollowRequest({
          subject: frankAgent.accountDid,
        })

      await expect(
        aliceAgent.api.app.bsky.graph.respondToFollowRequest({
          requestUri: createRes.data.uri,
          response: 'approve',
        }),
      ).rejects.toThrow(/not authorized/i)
    })

    it('validates response parameter', async () => {
      const jackAgent = network.pds.getClient()
      await jackAgent.createAccount({
        email: 'jack@test.com',
        handle: 'jack.test',
        password: 'jack-pass',
      })

      const createRes = await jackAgent.api.app.bsky.graph.createFollowRequest({
        subject: frankAgent.accountDid,
      })

      await expect(
        frankAgent.api.app.bsky.graph.respondToFollowRequest({
          requestUri: createRes.data.uri,
          response: 'invalid' as any,
        }),
      ).rejects.toThrow(/invalid/i)
    })

    it('requires authentication', async () => {
      const unauthAgent = network.pds.getClient()

      await expect(
        unauthAgent.api.app.bsky.graph.respondToFollowRequest({
          requestUri: 'at://did:plc:test/app.bsky.graph.followRequest/test',
          response: 'approve',
        }),
      ).rejects.toThrow()
    })
  })
})
