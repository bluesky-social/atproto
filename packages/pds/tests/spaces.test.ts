import { SeedClient, TestNetworkNoAppView, TestPds } from '@atproto/dev-env'
import { Client, DidString, xrpc } from '@atproto/lex'
import { parseCid } from '@atproto/lex-data'
import {
  LtHash,
  RepoCommit,
  createSpaceToken,
  verifyRepoCarFull,
} from '@atproto/space'
import { AtUriString, NsidString } from '@atproto/syntax'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import { com } from '../src/lexicons/index.js'

// Spaces tests run against a 3-PDS network:
//   pds1: alice (authority/owner), dan (co-located member)
//   pds2: bob  (remote member)
//   pds3: carol (not a member by default; joins where needed)
// Any test can reach into any PDS; most use one or two. Tests create a
// dedicated space per-test (distinct skey) so they don't order-depend on each
// other.
//
// NOTE (proposal 0016): the member list is the authority's internal concern and
// is NOT pushed to a member's PDS. A member's PDS materializes its local space
// row lazily on first write. So `listSpaces` on a member PDS reflects "spaces
// the user has written to", not "spaces the user was added to".
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

  // getSpace returns config as an open union; in simplespace it's always a
  // spaceConfig. Narrow it for assertions.
  const asSpaceConfig = (
    config: Record<string, unknown>,
  ): com.atproto.simplespace.defs.SpaceConfig => {
    expect(config.$type).toBe('com.atproto.simplespace.defs#spaceConfig')
    return config as unknown as com.atproto.simplespace.defs.SpaceConfig
  }

  type CreateSpaceConfig = {
    policy?: 'public' | 'member-list' | 'managing-app'
    managingApp?: string
    appAccess?: com.atproto.simplespace.defs.SpaceConfig['appAccess']
  }

  const createSpace = async (
    skey: string,
    members: DidString[] = [],
    config?: CreateSpaceConfig,
  ): Promise<AtUriString> => {
    const res = await pds1Client.call(
      com.atproto.simplespace.createSpace,
      {
        did: aliceDid,
        type: 'app.bsky.group' as NsidString,
        skey,
        config: config
          ? com.atproto.simplespace.defs.spaceConfig.build({
              policy: config.policy ?? 'member-list',
              appAccess:
                config.appAccess ?? com.atproto.simplespace.defs.open.build({}),
              managingApp: config.managingApp,
            })
          : undefined,
      },
      { headers: aliceHeaders },
    )
    const uri = res.uri as AtUriString
    for (const did of members) {
      await pds1Client.call(
        com.atproto.simplespace.addMember,
        { space: uri, did },
        { headers: aliceHeaders },
      )
    }
    return uri
  }

  // Issues a fresh space credential for a `memberPds`-hosted member: mint a
  // delegation token on the member's PDS, exchange it with the authority.
  const credentialFor = async (
    memberPds: TestPds,
    memberHeaders: { authorization: string },
    space: AtUriString,
  ): Promise<{ authorization: string }> => {
    const memberClient = memberPds.getClient()
    const tokenRes = await memberClient.call(
      com.atproto.space.getDelegationToken,
      { space },
      { headers: memberHeaders },
    )
    const credRes = await pds1Client.call(
      com.atproto.space.getSpaceCredential,
      { space },
      { headers: { authorization: `Bearer ${tokenRes.token}` } },
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
    expect(spaceUri).toBe(`at://${aliceDid}/space/app.bsky.group/create`)

    const res = await pds1Client.call(
      com.atproto.space.listSpaces,
      {},
      { headers: aliceHeaders },
    )
    const match = res.spaces.find((s) => s.uri === spaceUri)
    expect(match).toMatchObject({ uri: spaceUri, isOwner: true })
  })

  it('adds and lists members on the authority', async () => {
    const spaceUri = await createSpace('membership', [danDid])

    // Dan is a member but not the owner — addMember must refuse.
    await expect(
      pds1Client.call(
        com.atproto.simplespace.addMember,
        { space: spaceUri, did: carolDid },
        { headers: danHeaders },
      ),
    ).rejects.toThrow('Not the space owner')

    await pds1Client.call(
      com.atproto.simplespace.addMember,
      { space: spaceUri, did: bobDid },
      { headers: aliceHeaders },
    )

    const members = await pds1Client.call(
      com.atproto.simplespace.listMembers,
      { space: spaceUri },
      { headers: aliceHeaders },
    )
    const dids = members.members.map((m) => m.did)
    // alice (owner, auto-added) + dan + bob
    expect(dids).toContain(aliceDid)
    expect(dids).toContain(danDid)
    expect(dids).toContain(bobDid)

    // Remove bob and confirm he's gone from the member list.
    await pds1Client.call(
      com.atproto.simplespace.removeMember,
      { space: spaceUri, did: bobDid },
      { headers: aliceHeaders },
    )
    const after = await pds1Client.call(
      com.atproto.simplespace.listMembers,
      { space: spaceUri },
      { headers: aliceHeaders },
    )
    expect(after.members.map((m) => m.did)).not.toContain(bobDid)
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
        repo: danDid,
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
      { space: spaceUri, repo: danDid, collection: 'app.bsky.feed.post', rkey },
      { headers: danHeaders },
    )
    expect(got.value).toMatchObject({ text: 'hello from dan' })

    const oplog = await pds1.ctx.actorStore.read(danDid, (store) =>
      store.space.getRepoOplog(spaceUri, { limit: 100 }),
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
        repo: danDid,
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
      { space: spaceUri, repo: danDid, collection: 'app.bsky.feed.post', rkey },
      { headers: danHeaders },
    )

    const oplog = await pds1.ctx.actorStore.read(danDid, (store) =>
      store.space.getRepoOplog(spaceUri, { limit: 100 }),
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
      { space: spaceUri, repo: danDid, writes },
      { headers: danHeaders },
    )

    const oplog = await pds1.ctx.actorStore.read(danDid, (store) =>
      store.space.getRepoOplog(spaceUri, { limit: 100 }),
    )
    const batchOps = oplog.ops.slice(-3)
    expect(batchOps.map((o) => o.rev)).toEqual([
      batchOps[0].rev,
      batchOps[0].rev,
      batchOps[0].rev,
    ])
    expect(batchOps.map((o) => o.idx)).toEqual([0, 1, 2])
  })

  // Divergence here is silent and permanent, so assert it directly.
  const expectSetHashMatchesStore = async (
    pds: TestPds,
    did: DidString,
    space: AtUriString,
  ) => {
    const { records, state } = await pds.ctx.actorStore.read(
      did,
      async (s) => ({
        records: await s.space.listRecords(space, { limit: 1000 }),
        state: await s.space.getRepoState(space),
      }),
    )
    const recomputed = RepoCommit.fromRecords(
      records.map((r) => ({
        collection: r.collection,
        rkey: r.rkey,
        cid: parseCid(r.cid),
      })),
    )
    expect(
      recomputed.setHash.equals(RepoCommit.fromState(state?.setHash).setHash),
    ).toBe(true)
  }

  const post = (text: string) => ({
    $type: 'app.bsky.feed.post',
    text,
    createdAt: new Date().toISOString(),
  })

  it('rejects a duplicate create within one batch', async () => {
    // Resolving against storage alone would let both through, adding to the set
    // hash twice while the upsert leaves one row.
    const spaceUri = await createSpace('batch-dupe', [danDid])

    await expect(
      pds1Client.call(
        com.atproto.space.applyWrites,
        {
          space: spaceUri,
          repo: danDid,
          writes: [0, 1].map(() => ({
            $type: 'com.atproto.space.applyWrites#create' as const,
            collection: 'app.bsky.feed.post' as NsidString,
            rkey: 'dupe',
            value: post('dupe'),
          })),
        },
        { headers: danHeaders },
      ),
    ).rejects.toThrow(/already exists/i)

    await expectSetHashMatchesStore(pds1, danDid, spaceUri)
  })

  it('applies dependent writes within one batch', async () => {
    // Each write must see the effect of the previous one.
    const spaceUri = await createSpace('batch-dependent', [danDid])
    const collection = 'app.bsky.feed.post' as NsidString

    await pds1Client.call(
      com.atproto.space.applyWrites,
      {
        space: spaceUri,
        repo: danDid,
        writes: [
          {
            $type: 'com.atproto.space.applyWrites#create' as const,
            collection,
            rkey: 'dependent',
            value: post('first'),
          },
          {
            $type: 'com.atproto.space.applyWrites#update' as const,
            collection,
            rkey: 'dependent',
            value: post('second'),
          },
          {
            $type: 'com.atproto.space.applyWrites#create' as const,
            collection,
            rkey: 'survivor',
            value: post('survivor'),
          },
          {
            $type: 'com.atproto.space.applyWrites#delete' as const,
            collection,
            rkey: 'dependent',
          },
        ],
      },
      { headers: danHeaders },
    )

    const records = await pds1.ctx.actorStore.read(danDid, (store) =>
      store.space.listRecords(spaceUri, { limit: 100 }),
    )
    expect(records.map((r) => r.rkey)).toEqual(['survivor'])
    await expectSetHashMatchesStore(pds1, danDid, spaceUri)
  })

  it('never splits a rev across oplog pages', async () => {
    // `since` advances by rev, so a partial rev would drop the remainder.
    const spaceUri = await createSpace('oplog-atomic', [danDid])

    await pds1Client.call(
      com.atproto.space.applyWrites,
      {
        space: spaceUri,
        repo: danDid,
        writes: [0, 1, 2, 3, 4].map((i) => ({
          $type: 'com.atproto.space.applyWrites#create' as const,
          collection: 'app.bsky.feed.post' as NsidString,
          rkey: `atomic-${i}`,
          value: post(`atomic ${i}`),
        })),
      },
      { headers: danHeaders },
    )

    const page = await pds1.ctx.actorStore.read(danDid, (store) =>
      store.space.getRepoOplog(spaceUri, { limit: 2 }),
    )
    // All 5 share one rev, so the batch comes back whole despite limit: 2.
    expect(page.ops).toHaveLength(5)
    expect(new Set(page.ops.map((o) => o.rev)).size).toBe(1)
  })

  it('withholds the commit until the oplog is drained to head', async () => {
    const spaceUri = await createSpace('oplog-commit', [danDid])
    const collection = 'app.bsky.feed.post' as NsidString

    for (const i of [0, 1, 2]) {
      await pds1Client.call(
        com.atproto.space.createRecord,
        {
          space: spaceUri,
          repo: danDid,
          collection,
          rkey: `paged-${i}`,
          record: post(`paged ${i}`),
        },
        { headers: danHeaders },
      )
    }

    const credential = await credentialFor(pds1, danHeaders, spaceUri)
    const first = await pds1Client.call(
      com.atproto.space.listRepoOps,
      { space: spaceUri, repo: danDid, limit: 1 },
      { headers: credential },
    )
    expect(first.commit).toBeUndefined()
    expect(first.cursor).toBeDefined()

    let cursor = first.cursor
    let commit: unknown
    for (let i = 0; i < 5 && cursor; i++) {
      const next = await pds1Client.call(
        com.atproto.space.listRepoOps,
        { space: spaceUri, repo: danDid, since: cursor, limit: 1 },
        { headers: credential },
      )
      cursor = next.cursor
      commit = next.commit
    }
    expect(commit).toBeDefined()
  })

  // ---------------- Cross-PDS ----------------

  it('writes a record from a remote PDS', async () => {
    // Story: bob (pds2) writes. The authority will receive a notifyWrite
    // fire-and-forget, but the authoritative path is the oplog on bob's PDS.
    const spaceUri = await createSpace('remote-write', [bobDid])

    const created = await pds2Client.call(
      com.atproto.space.createRecord,
      {
        space: spaceUri,
        repo: bobDid,
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
      store.space.getRepoOplog(spaceUri, { limit: 100 }),
    )
    const lastOp = oplog.ops[oplog.ops.length - 1]
    expect(lastOp.action).toBe('create')
    expect(lastOp.cid).toBe(created.cid)

    // Bob's PDS lazily materialized the space on first write.
    const bobList = await pds2Client.call(
      com.atproto.space.listSpaces,
      {},
      { headers: bobHeaders },
    )
    expect(bobList.spaces.find((s) => s.uri === spaceUri)).toMatchObject({
      uri: spaceUri,
      isOwner: false,
    })
  })

  it('listRepos returns the writer set from notifyWrite', async () => {
    const spaceUri = await createSpace('writer-set', [bobDid])

    // Bob writes on pds2; his PDS fires a best-effort notifyWrite to the
    // authority (pds1), which records him in the writer set.
    await pds2Client.call(
      com.atproto.space.createRecord,
      {
        space: spaceUri,
        repo: bobDid,
        collection: 'app.bsky.feed.post',
        record: {
          $type: 'app.bsky.feed.post',
          text: 'writer set entry',
          createdAt: new Date().toISOString(),
        },
      },
      { headers: bobHeaders },
    )

    // notifyWrite is fire-and-forget — poll the authority's writer set.
    const credHeaders = await credentialFor(pds2, bobHeaders, spaceUri)
    let writerDids: string[] = []
    for (let i = 0; i < 50; i++) {
      const repos = await pds1Client.call(
        com.atproto.space.listRepos,
        { space: spaceUri },
        { headers: credHeaders },
      )
      writerDids = repos.repos.map((r) => r.did)
      if (writerDids.includes(bobDid)) break
      await new Promise((r) => setTimeout(r, 50))
    }
    expect(writerDids).toContain(bobDid)
    // The writer set is not the member list — alice (a member who hasn't
    // written) is absent.
    expect(writerDids).not.toContain(aliceDid)
  })

  it('reads a member repo with a space credential', async () => {
    const spaceUri = await createSpace('cred-read', [bobDid, carolDid])

    // Bob writes on pds2.
    await pds2Client.call(
      com.atproto.space.createRecord,
      {
        space: spaceUri,
        repo: bobDid,
        collection: 'app.bsky.feed.post',
        record: {
          $type: 'app.bsky.feed.post',
          text: 'for the record',
          createdAt: new Date().toISOString(),
        },
      },
      { headers: bobHeaders },
    )

    // Carol (pds3) exchanges her delegation token for a credential and uses it
    // to read bob's repo on pds2.
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

  // ---------------- Full-state recovery ----------------

  it('serves a verifiable repo CAR for full-state recovery', async () => {
    const spaceUri = await createSpace('get-repo', [bobDid, carolDid])
    const collections: NsidString[] = [
      'app.bsky.feed.post' as NsidString,
      'app.bsky.feed.like' as NsidString,
    ]

    for (const collection of collections) {
      for (const i of [0, 1]) {
        await pds2Client.call(
          com.atproto.space.createRecord,
          {
            space: spaceUri,
            repo: bobDid,
            collection,
            rkey: `car-${i}`,
            record:
              collection === 'app.bsky.feed.post'
                ? post(`car ${i}`)
                : {
                    $type: 'app.bsky.feed.like',
                    subject: { uri: `at://x/y/${i}`, cid: 'bafy' },
                    createdAt: new Date().toISOString(),
                  },
          },
          { headers: bobHeaders },
        )
      }
    }

    // Carol syncs bob's repo in full, as a syncing service would.
    const credHeaders = await credentialFor(pds3, carolHeaders, spaceUri)
    const res = await fetch(
      `${pds2.url}/xrpc/com.atproto.space.getRepo?space=${encodeURIComponent(spaceUri)}&repo=${bobDid}`,
      { headers: credHeaders },
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain(
      'application/vnd.ipld.car',
    )
    const car = new Uint8Array(await res.arrayBuffer())

    const didKey = (await pds2.ctx.actorStore.keypair(bobDid)).did()
    const recovered = await verifyRepoCarFull([car], {
      space: spaceUri,
      author: bobDid,
      didKey,
    })

    expect(recovered.records).toHaveLength(4)
    expect(recovered.repo.matches(recovered.commit)).toBe(true)

    const state = await pds2.ctx.actorStore.read(bobDid, (store) =>
      store.space.getRepoState(spaceUri),
    )
    expect(
      recovered.repo.setHash.equals(
        RepoCommit.fromState(state?.setHash).setHash,
      ),
    ).toBe(true)
    expect(recovered.commit.rev).toBe(state?.rev)

    const texts = recovered.records
      .filter((r) => r.collection === 'app.bsky.feed.post')
      .map((r) => (r.record as { text: string }).text)
      .sort()
    expect(texts).toEqual(['car 0', 'car 1'])
  })

  it('refuses a repo CAR without a credential for that space', async () => {
    const spaceUri = await createSpace('get-repo-auth', [bobDid])
    const otherSpace = await createSpace('get-repo-auth-other', [carolDid])

    const wrongCred = await credentialFor(pds3, carolHeaders, otherSpace)
    const res = await fetch(
      `${pds2.url}/xrpc/com.atproto.space.getRepo?space=${encodeURIComponent(spaceUri)}&repo=${bobDid}`,
      { headers: wrongCred },
    )
    expect(res.status).toBeGreaterThanOrEqual(400)
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
          repo: danDid,
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
      { space: spaceUri, repo: danDid, limit: 1 },
      { headers: danHeaders },
    )
    expect(first.records.length).toBe(1)
    expect(first.cursor).toBeDefined()

    const second = await pds1Client.call(
      com.atproto.space.listRecords,
      { space: spaceUri, repo: danDid, limit: 1, cursor: first.cursor },
      { headers: danHeaders },
    )
    expect(second.records.length).toBe(1)
    expect(second.records[0].collection).not.toBe(first.records[0].collection)

    const third = await pds1Client.call(
      com.atproto.space.listRecords,
      { space: spaceUri, repo: danDid, limit: 1, cursor: second.cursor },
      { headers: danHeaders },
    )
    expect(third.records).toEqual([])
  })

  // ---------------- Credential issuance ----------------

  it('refuses a credential for a revoked member', async () => {
    const spaceUri = await createSpace('cred-revoke', [carolDid])

    // Carol mints a delegation token while she's a member.
    const tokenRes = await pds3Client.call(
      com.atproto.space.getDelegationToken,
      { space: spaceUri },
      { headers: carolHeaders },
    )

    // Alice removes her before she can redeem.
    await pds1Client.call(
      com.atproto.simplespace.removeMember,
      { space: spaceUri, did: carolDid },
      { headers: aliceHeaders },
    )

    await expect(
      pds1Client.call(
        com.atproto.space.getSpaceCredential,
        { space: spaceUri },
        { headers: { authorization: `Bearer ${tokenRes.token}` } },
      ),
    ).rejects.toThrow()
  })

  it('scopes a credential to one space', async () => {
    // Carol is a member of one space; she can read it, not a sibling space.
    const targetSpace = await createSpace('cred-target', [carolDid])
    const otherSpace = await createSpace('cred-other', [])

    const credHeaders = await credentialFor(pds3, carolHeaders, targetSpace)

    const ok = await pds1Client.call(
      com.atproto.space.getLatestCommit,
      { space: targetSpace, repo: aliceDid },
      { headers: credHeaders },
    )
    expect(ok).toBeDefined()

    await expect(
      pds1Client.call(
        com.atproto.space.listRepoOps,
        { space: otherSpace, repo: aliceDid },
        { headers: credHeaders },
      ),
    ).rejects.toThrow()
  })

  it('refuses a credential the space authority did not issue', async () => {
    // Carol self-signs a credential for one of alice's spaces. It verifies
    // against her own signing key, so nothing but the iss/authority check
    // stands between her and the space. Alice writes a record first so the
    // read would otherwise succeed — the rejection has to come from auth.
    const spaceUri = await createSpace('cred-forged', [carolDid])
    await pds1Client.call(
      com.atproto.space.createRecord,
      {
        space: spaceUri,
        repo: aliceDid,
        collection: 'app.bsky.feed.post',
        record: {
          $type: 'app.bsky.feed.post',
          text: 'forgery target',
          createdAt: new Date().toISOString(),
        },
      },
      { headers: aliceHeaders },
    )

    // A credential alice did issue reads it fine.
    const valid = await credentialFor(pds3, carolHeaders, spaceUri)
    expect(
      await pds1Client.call(
        com.atproto.space.getLatestCommit,
        { space: spaceUri, repo: aliceDid },
        { headers: valid },
      ),
    ).toBeDefined()

    const carolKeypair = await pds3.ctx.actorStore.keypair(carolDid)
    const forged = await createSpaceToken(
      'credential',
      { iss: carolDid, sub: spaceUri },
      carolKeypair,
    )

    await expect(
      pds1Client.call(
        com.atproto.space.getLatestCommit,
        { space: spaceUri, repo: aliceDid },
        { headers: { authorization: `Bearer ${forged}` } },
      ),
    ).rejects.toThrow(/issuer is not the space authority/)

    // listRepos authorizes off the credential too, on a separate path.
    await expect(
      pds1Client.call(
        com.atproto.space.listRepos,
        { space: spaceUri },
        { headers: { authorization: `Bearer ${forged}` } },
      ),
    ).rejects.toThrow(/issuer is not the space authority/)
  })

  it('refuses a credential whose kid names a key the authority does not publish', async () => {
    // The authority signs with its #atproto key and says so. A credential that
    // claims #atproto_space must be verified against that key, which alice does
    // not publish — so it cannot pass by falling back to #atproto.
    const spaceUri = await createSpace('cred-kid-mismatch', [])

    const aliceKeypair = await pds1.ctx.actorStore.keypair(aliceDid)
    const mismatched = await createSpaceToken(
      'credential',
      { iss: aliceDid, sub: spaceUri, kid: '#atproto_space' },
      aliceKeypair,
    )

    await expect(
      pds1Client.call(
        com.atproto.space.getLatestCommit,
        { space: spaceUri, repo: aliceDid },
        { headers: { authorization: `Bearer ${mismatched}` } },
      ),
    ).rejects.toThrow(/missing or bad key/)
  })

  // ---------------- Space config ----------------

  it('createSpace persists config (managing-app + allowList)', async () => {
    const spaceUri = await createSpace('config-create', [], {
      policy: 'managing-app',
      managingApp: 'did:web:example.com#forum',
      appAccess: com.atproto.simplespace.defs.allowList.build({
        allowed: ['app:one', 'app:two'],
      }),
    })

    const got = await pds1Client.call(
      com.atproto.space.getSpace,
      { space: spaceUri },
      { headers: aliceHeaders },
    )
    expect(got.uri).toBe(spaceUri)
    const config = asSpaceConfig(got.config)
    expect(config).toMatchObject({
      policy: 'managing-app',
      managingApp: 'did:web:example.com#forum',
    })
    expect(config.appAccess).toMatchObject({
      $type: 'com.atproto.simplespace.defs#allowList',
      allowed: ['app:one', 'app:two'],
    })
  })

  it('createSpace defaults to a member-list + open space', async () => {
    const spaceUri = await createSpace('config-defaults')
    const got = await pds1Client.call(
      com.atproto.space.getSpace,
      { space: spaceUri },
      { headers: aliceHeaders },
    )
    const config = asSpaceConfig(got.config)
    expect(config).toMatchObject({
      policy: 'member-list',
    })
    expect(config.appAccess).toMatchObject({
      $type: 'com.atproto.simplespace.defs#open',
    })
  })

  it('getSpace refuses non-authority', async () => {
    const spaceUri = await createSpace('config-getspace-nonowner', [bobDid])
    // Bob is a member but the space lives on alice's PDS — even calling on
    // his own PDS, getSpace must refuse since he's not the authority.
    await expect(
      pds2Client.call(
        com.atproto.space.getSpace,
        { space: spaceUri },
        { headers: bobHeaders },
      ),
    ).rejects.toThrow()
  })

  it('updateSpace patches policy and appAccess', async () => {
    const spaceUri = await createSpace('config-update-each')

    await pds1Client.call(
      com.atproto.simplespace.updateSpace,
      { space: spaceUri, policy: 'public' },
      { headers: aliceHeaders },
    )
    let got = await pds1Client.call(
      com.atproto.space.getSpace,
      { space: spaceUri },
      { headers: aliceHeaders },
    )
    expect(got.config).toMatchObject({ policy: 'public' })

    await pds1Client.call(
      com.atproto.simplespace.updateSpace,
      {
        space: spaceUri,
        appAccess: com.atproto.simplespace.defs.allowList.build({
          allowed: ['app:x'],
        }),
      },
      { headers: aliceHeaders },
    )
    got = await pds1Client.call(
      com.atproto.space.getSpace,
      { space: spaceUri },
      { headers: aliceHeaders },
    )
    // policy untouched; appAccess replaced.
    const config = asSpaceConfig(got.config)
    expect(config).toMatchObject({ policy: 'public' })
    expect(config.appAccess).toMatchObject({
      $type: 'com.atproto.simplespace.defs#allowList',
      allowed: ['app:x'],
    })
  })

  it('updateSpace clears managingApp on empty string', async () => {
    const spaceUri = await createSpace('config-clear-managing', [], {
      policy: 'member-list',
      managingApp: 'did:web:example.com#forum',
    })

    await pds1Client.call(
      com.atproto.simplespace.updateSpace,
      { space: spaceUri, managingApp: '' },
      { headers: aliceHeaders },
    )
    const got = await pds1Client.call(
      com.atproto.space.getSpace,
      { space: spaceUri },
      { headers: aliceHeaders },
    )
    expect(asSpaceConfig(got.config).managingApp).toBeUndefined()
  })

  it('updateSpace refuses non-owner', async () => {
    const spaceUri = await createSpace('config-update-nonowner', [bobDid])
    await expect(
      pds2Client.call(
        com.atproto.simplespace.updateSpace,
        { space: spaceUri, policy: 'public' },
        { headers: bobHeaders },
      ),
    ).rejects.toThrow()
  })

  // ---------------- Credential mint: config gates ----------------

  it('mints a credential for a non-member when policy is public', async () => {
    // Carol is NOT a member, but policy=public bypasses the member check.
    const spaceUri = await createSpace('config-public-mint', [], {
      policy: 'public',
    })

    const credHeaders = await credentialFor(pds3, carolHeaders, spaceUri)
    expect(credHeaders.authorization).toMatch(/^Bearer /)
  })

  it('refuses credential mint for a non-member under member-list policy', async () => {
    // Default member-list policy; carol is not on the list.
    const spaceUri = await createSpace('config-memberlist-deny')

    const tokenRes = await pds3Client.call(
      com.atproto.space.getDelegationToken,
      { space: spaceUri },
      { headers: carolHeaders },
    )
    await expect(
      pds1Client.call(
        com.atproto.space.getSpaceCredential,
        { space: spaceUri },
        { headers: { authorization: `Bearer ${tokenRes.token}` } },
      ),
    ).rejects.toThrow()
  })

  it('refuses credential mint when appAccess is allowList and no attestation', async () => {
    // policy public so the user passes; appAccess allowList requires an
    // attested client_id, which the test flow does not supply.
    const spaceUri = await createSpace('config-app-allowlist', [], {
      policy: 'public',
      appAccess: com.atproto.simplespace.defs.allowList.build({
        allowed: ['https://app.example.com/client-metadata.json'],
      }),
    })

    const tokenRes = await pds3Client.call(
      com.atproto.space.getDelegationToken,
      { space: spaceUri },
      { headers: carolHeaders },
    )
    await expect(
      pds1Client.call(
        com.atproto.space.getSpaceCredential,
        { space: spaceUri },
        { headers: { authorization: `Bearer ${tokenRes.token}` } },
      ),
    ).rejects.toThrow()
  })

  // ---------------- Sync recovery ----------------

  it('recovers from a pruned oplog via listRecords', async () => {
    // Tells the full-resync story: when the oplog no longer reaches back to
    // a consumer's cursor, an incremental pull yields an incomplete diff,
    // which is detectable via setHash mismatch. Recovery uses listRecords +
    // getLatestCommit — no new endpoint needed.
    const spaceUri = await createSpace('prune', [bobDid])

    const writePost = (text: string) =>
      pds2Client.call(
        com.atproto.space.createRecord,
        {
          space: spaceUri,
          repo: bobDid,
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
      store.space.getRepoOplog(spaceUri, { since: consumerSince, limit: 100 }),
    )
    expect(incremental.ops.length).toBe(2)

    const applied = new RepoCommit()
    for (const op of incremental.ops) {
      applied.applyOp({
        collection: op.collection,
        rkey: op.rkey,
        cid: op.cid ? parseCid(op.cid) : null,
        prev: op.prev ? parseCid(op.prev) : null,
      })
    }
    expect(
      applied.setHash.equals(
        RepoCommit.fromState(incremental.setHash!).setHash,
      ),
    ).toBe(false)

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

    const recomputed = RepoCommit.fromRecords(
      allRecords.map((r) => ({
        collection: r.collection,
        rkey: r.rkey,
        cid: parseCid(r.cid),
      })),
    )
    const repoState = await pds2.ctx.actorStore.read(bobDid, (store) =>
      store.space.getRepoState(spaceUri),
    )
    expect(
      recomputed.setHash.equals(
        RepoCommit.fromState(repoState!.setHash!).setHash,
      ),
    ).toBe(true)
  })

  // ---------------- Adversarial ----------------

  it('rejects a notifyWrite that spoofs the writer', async () => {
    // Bob (pds2, member) signs a notifyWrite but claims carol wrote. Authority
    // must refuse based on iss ≠ body.repo.
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
          space: spaceUri as AtUriString,
          repo: carolDid,
          rev: 'spoof',
          hash: new LtHash().digest(),
        },
      }),
    ).rejects.toThrow()
  })

  it('rejects a notifyWrite from a non-member', async () => {
    // iss === body.repo, but the signer isn't in the member list.
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
          space: spaceUri as AtUriString,
          repo: carolDid,
          rev: 'spoof',
          hash: new LtHash().digest(),
        },
      }),
    ).rejects.toThrow()
  })
})
