import { TID } from '@atproto/common'
import {
  SeedClient,
  TestNetworkNoAppView,
  type TestPds,
} from '@atproto/dev-env'
import { encode } from '@atproto/lex-cbor'
import { cidForCbor, getBlobCidString, ui8Concat } from '@atproto/lex-data'
import {
  RepoCommit,
  type SpaceMetaArchive,
  readSpaceMetaStar,
  serializeRepo,
  serializeSpaceMeta,
} from '@atproto/space'
import {
  type DidString,
  type RecordKeyString,
  SpaceRef,
  type SpaceRefString,
} from '@atproto/syntax'
import { com } from '../../src/lexicons/index.js'
import { prepareCreate } from '../../src/repo/index.js'
import {
  type Actor,
  SpaceClient,
  TEST_COLLECTION,
  TEST_SPACE_TYPE,
  record,
} from '../_space.js'

const { memberspace, personalspace } = com.atproto

/**
 * Moving an account's space data to a new host, on top of the usual account
 * migration. Each space the account is the authority of moves as a space host
 * archive (exportSpaceMeta → importSpaceMeta), then each of its space repos moves as a
 * STAR file (getRepo → importRepo), then the blobs those repos reference.
 */
describe('space account migration', () => {
  let network: TestNetworkNoAppView
  let sc: SpaceClient
  let alice: Actor // the migrating account, on the original pds
  let newAlice: Actor // the same account, on the new pds
  let bob: Actor // member, stays put
  let dan: Actor // read-only member, stays put

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'space_migration',
      extraPdses: 1,
    })
    sc = new SpaceClient(network)
    alice = await sc.createActor('alice', network.pds)
    bob = await sc.createActor('bob', network.pds)
    dan = await sc.createActor('dan', network.pds)
    newAlice = await createMigratedAccount(alice, network.extraPdses[0])
  })

  afterAll(async () => {
    await network?.close()
  })

  const exportSpaceMeta = async (actor: Actor, space: SpaceRefString) => {
    const res = await actor.client.xrpc(com.atproto.space.exportSpaceMeta, {
      params: { space },
      headers: actor.headers,
    })
    return res.body
  }

  const importSpaceMeta = (actor: Actor, archive: Uint8Array) =>
    actor.client.xrpc(com.atproto.space.importSpaceMeta, {
      body: archive,
      headers: actor.headers,
    })

  const getRepo = async (actor: Actor, space: SpaceRefString) => {
    const res = await actor.client.xrpc(com.atproto.space.getRepo, {
      params: { space, repo: actor.did },
      headers: actor.headers,
    })
    return res.body
  }

  const importRepo = (actor: Actor, star: Uint8Array) =>
    actor.client.xrpc(com.atproto.space.importRepo, {
      body: star,
      headers: actor.headers,
    })

  const moveBlobs = async (space: SpaceRefString) => {
    const { cids } = await alice.client.call(
      com.atproto.space.listBlobs,
      { space, repo: alice.did },
      { headers: alice.headers },
    )
    for (const cid of cids) {
      const blob = await alice.client.xrpc(com.atproto.space.getBlob, {
        params: { space, repo: alice.did, cid },
        headers: alice.headers,
      })
      await newAlice.client.uploadBlob(blob.body, {
        headers: newAlice.headers,
        encoding: blob.encoding,
      })
    }
  }

  // Steps 2 and 3 of the flow: each space the account is the authority of comes
  // before the account's own repo in it.
  const migrate = async (spaces: SpaceRefString[]) => {
    for (const space of spaces) {
      if (SpaceRef.parse(space).spaceDid === alice.did) {
        await importSpaceMeta(newAlice, await exportSpaceMeta(alice, space))
      }
    }
    for (const space of spaces) {
      await importRepo(newAlice, await getRepo(alice, space))
      await moveBlobs(space)
    }
  }

  const writers = (actor: Actor, space: SpaceRefString) =>
    actor.pds.ctx.actorStore.read(actor.did, (store) =>
      store.space.listWriters(space),
    )

  const latestCommit = (actor: Actor, space: SpaceRefString) =>
    actor.client.call(
      com.atproto.space.getLatestCommit,
      { space, repo: alice.did },
      { headers: actor.headers },
    )

  it('moves the spaces an account is the authority of, and its repos', async () => {
    const space = await sc.createSpace(alice, {
      policy: memberspace.policy.$build({
        publishPolicy: true,
        publishMembers: true,
      }),
    })
    await sc.putMember(alice, space, bob)
    await sc.putMember(alice, space, dan, { read: true, write: false })
    await sc.write(bob, space, { rkey: 'from-bob' })

    const bytes = new Uint8Array([1, 2, 3, 4])
    const { body: uploaded } = await alice.client.uploadBlob(bytes, {
      headers: alice.headers,
      encoding: 'image/png',
    })
    await sc.write(alice, space, {
      rkey: 'from-alice',
      record: {
        $type: TEST_COLLECTION,
        text: 'with a blob',
        image: uploaded.blob,
      },
    })

    // A space under another authority, which only alice's repo moves out of.
    const guestSpace = await sc.createSpace(bob, {
      skey: 'guest',
      members: [alice],
    })
    await sc.write(alice, guestSpace, { rkey: 'guest' })

    const { spaces } = await alice.client.call(
      com.atproto.space.listSpaces,
      {},
      { headers: alice.headers },
    )
    expect(spaces.map((s) => s.uri)).toEqual(
      expect.arrayContaining([space, guestSpace]),
    )

    const original = await readSpaceMetaStar([
      await exportSpaceMeta(alice, space),
    ])
    const originalWriters = await writers(alice, space)
    const originalCommit = await latestCommit(alice, space)

    await migrate([space, guestSpace])

    // The policy and member list arrive intact.
    const newSpace = await newAlice.client.call(
      com.atproto.space.getSpace,
      { space },
      { headers: newAlice.headers },
    )
    expect(newSpace.policy).toEqual(original.policy)
    const { members } = await newAlice.client.call(
      com.atproto.memberspace.listMembers,
      { space },
      { headers: newAlice.headers },
    )
    expect(members).toHaveLength(2)
    expect(members).toEqual(
      expect.arrayContaining([
        { did: bob.did, read: true, write: true },
        { did: dan.did, read: true, write: false },
      ]),
    )

    // The writer set, the authority included, keeps its place in the space sequence.
    expect(originalWriters.map((w) => w.did).sort()).toEqual(
      [alice.did, bob.did].sort(),
    )
    expect(await writers(newAlice, space)).toEqual(originalWriters)

    // Re-exported from the new host, the space is unchanged.
    const reexported = await readSpaceMetaStar([
      await exportSpaceMeta(newAlice, space),
    ])
    expect(reexported).toEqual(original)

    // The repo holds the same records, so the same commit data under a new rev.
    const newCommit = await latestCommit(newAlice, space)
    expect(newCommit.commit.data).toEqual(originalCommit.commit.data)
    expect(newCommit.commit.rev > originalCommit.commit.rev).toBe(true)
    const listRecords = (actor: Actor) =>
      actor.client.call(
        com.atproto.space.listRecords,
        { space, repo: alice.did },
        { headers: actor.headers },
      )
    expect((await listRecords(newAlice)).records).toEqual(
      (await listRecords(alice)).records,
    )

    // The blob was uploaded after its record arrived, and is served with it.
    const blob = await newAlice.client.xrpc(com.atproto.space.getBlob, {
      params: { space, repo: alice.did, cid: getBlobCidString(uploaded.blob) },
      headers: newAlice.headers,
    })
    expect(blob.body).toEqual(bytes)

    const guestCommit = await latestCommit(newAlice, guestSpace)
    expect(guestCommit.commit.data).toEqual(
      (await latestCommit(alice, guestSpace)).commit.data,
    )
  })

  it("requires the space before the authority's own repo in it", async () => {
    const space = await sc.createSpace(alice, {
      policy: personalspace.policy.$build({}),
    })
    await sc.write(alice, space)

    const star = await getRepo(alice, space)
    await expect(importRepo(newAlice, star)).rejects.toMatchObject({
      error: 'SpaceNotFound',
    })

    await importSpaceMeta(newAlice, await exportSpaceMeta(alice, space))
    await importRepo(newAlice, star)
    const newCommit = await latestCommit(newAlice, space)
    expect(newCommit.commit.data).toEqual(
      (await latestCommit(alice, space)).commit.data,
    )
  })

  it('replaces what the new host holds when imported again', async () => {
    const space = await sc.createSpace(alice, { members: [bob] })
    await sc.write(alice, space, { rkey: 'kept' })
    await sc.write(alice, space, { rkey: 'deleted' })
    await migrate([space])

    // A record the new host holds that the old host never had, along with its op.
    await newAlice.pds.ctx.actorStore.transact(alice.did, async (txn) => {
      const write = await prepareCreate({
        did: alice.did,
        space,
        collection: TEST_COLLECTION,
        rkey: 'stale' as RecordKeyString,
        record: record(TEST_COLLECTION),
      })
      await txn.space.applyWrites(space, [write])
    })

    await sc.del(alice, space, { rkey: 'deleted' })
    await sc.write(alice, space, { rkey: 'added' })
    await sc.removeMember(alice, space, bob)
    await migrate([space])

    const original = await readSpaceMetaStar([
      await exportSpaceMeta(alice, space),
    ])
    expect(
      await readSpaceMetaStar([await exportSpaceMeta(newAlice, space)]),
    ).toEqual(original)
    expect((await latestCommit(newAlice, space)).commit.data).toEqual(
      (await latestCommit(alice, space)).commit.data,
    )
    const { ops } = await newAlice.client.call(
      com.atproto.space.listRepoOps,
      { space, repo: alice.did },
      { headers: newAlice.headers },
    )
    expect(ops).toEqual([])
  })

  it("keeps the percent-encoded port of a did:web member's DID", async () => {
    const space = await sc.createSpace(alice)
    const did = 'did:web:localhost%3A2583' as DidString
    await alice.client.call(
      com.atproto.memberspace.putMember,
      { space, did, read: true, write: true },
      { headers: alice.headers },
    )
    await importSpaceMeta(newAlice, await exportSpaceMeta(alice, space))

    const { members } = await newAlice.client.call(
      com.atproto.memberspace.listMembers,
      { space },
      { headers: newAlice.headers },
    )
    expect(members).toEqual([{ did, read: true, write: true }])
  })

  it('rejects a repo with a record that is not canonical DRISL', async () => {
    // DRISL orders map keys by length first, so `text` belongs before `$type`.
    const bytes = ui8Concat([
      new Uint8Array([0xa2]), // a map of two entries
      encode('$type'),
      encode(TEST_COLLECTION),
      encode('text'),
      encode('out of order'),
    ])
    const rkey = 'non-canonical' as RecordKeyString
    const space: SpaceRefString = `at://${bob.did}/space/${TEST_SPACE_TYPE}/non-canonical`
    const commit = new RepoCommit()
      .add(TEST_COLLECTION, rkey, await cidForCbor(bytes))
      .toCommit({ space, repo: alice.did, rev: TID.nextStr() })

    const star = await collect(
      serializeRepo(commit, [{ collection: TEST_COLLECTION, rkey, bytes }]),
    )
    await expect(importRepo(newAlice, star)).rejects.toMatchObject({
      error: 'InvalidRequest',
      message: expect.stringContaining('not canonical DRISL'),
    })
  })

  it("imports only the account's own spaces and repos", async () => {
    const space = await sc.createSpace(bob, { members: [alice] })
    await sc.write(bob, space)

    await expect(
      importSpaceMeta(newAlice, await exportSpaceMeta(bob, space)),
    ).rejects.toMatchObject({ error: 'NotSpaceOwner' })
    await expect(
      importRepo(newAlice, await getRepo(bob, space)),
    ).rejects.toMatchObject({ error: 'InvalidRequest' })
  })

  describe('rejects an archive', () => {
    const archiveFor = (
      skey: string,
      archive: Omit<SpaceMetaArchive, 'space'>,
    ): AsyncIterable<Uint8Array> =>
      serializeSpaceMeta({
        space: `at://${alice.did}/space/${TEST_SPACE_TYPE}/${skey}`,
        ...archive,
      })

    const importArchive = async (archive: AsyncIterable<Uint8Array>) =>
      importSpaceMeta(newAlice, await collect(archive))

    it('with a policy the host does not implement', async () => {
      const archive = archiveFor('unsupported', {
        policy: { $type: 'com.example.policy' },
        policyState: [],
        writers: [],
      })
      await expect(importArchive(archive)).rejects.toMatchObject({
        error: 'UnsupportedPolicy',
      })
    })

    it('with policy state the policy does not define', async () => {
      const archive = archiveFor('unrecognized-state', {
        policy: memberspace.policy.$build({}),
        policyState: [
          {
            key: `com.example.allowList/${bob.did}`,
            value: { $type: 'com.example.allowList' },
          },
        ],
        writers: [],
      })
      await expect(importArchive(archive)).rejects.toMatchObject({
        error: 'InvalidRequest',
        message: expect.stringContaining('Unrecognized policy state'),
      })
    })

    it('with a member list for a policy that keeps none', async () => {
      const archive = archiveFor('personal-members', {
        policy: personalspace.policy.$build({}),
        policyState: [
          {
            key: `${memberspace.member.$type}/${bob.did}`,
            value: memberspace.member.$build({ read: true, write: true }),
          },
        ],
        writers: [],
      })
      await expect(importArchive(archive)).rejects.toMatchObject({
        error: 'InvalidRequest',
        message: expect.stringContaining('Unrecognized policy state'),
      })
    })

    it('that does not parse', async () => {
      await expect(
        importSpaceMeta(newAlice, new Uint8Array([1, 2, 3])),
      ).rejects.toMatchObject({ error: 'InvalidRequest' })
    })
  })
})

async function collect(stream: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

// Create the account on another host under the same DID, as account migration
// does. The new account stays deactivated, as it would until the migration ends.
async function createMigratedAccount(
  actor: Actor,
  pds: TestPds,
): Promise<Actor> {
  const { token } = await actor.client.call(
    com.atproto.server.getServiceAuth,
    {
      aud: pds.ctx.cfg.service.did as DidString,
      lxm: com.atproto.server.createAccount.$lxm,
    },
    { headers: actor.headers },
  )
  const client = pds.getClient()
  const account = await client.call(
    com.atproto.server.createAccount,
    {
      did: actor.did,
      handle: `${actor.name}.test2`,
      email: `${actor.name}@test.com`,
      password: `${actor.name}-pass`,
    },
    { headers: { authorization: `Bearer ${token}` } },
  )
  return {
    ...actor,
    headers: SeedClient.getHeaders(account.accessJwt),
    pds,
    client,
  }
}
