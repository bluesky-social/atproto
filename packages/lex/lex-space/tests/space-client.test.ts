import {
  afterAll,
  assert,
  beforeAll,
  describe,
  expect,
  expectTypeOf,
  it,
} from 'vitest'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import type { CidString, Client } from '@atproto/lex-client'
import { getBlobCidString } from '@atproto/lex-data'
import { l } from '@atproto/lex-schema'
import { SpaceRef, type SpaceRefString, isValidTid } from '@atproto/syntax'
import { createDidResolver } from '@atproto-labs/did-resolver'
import {
  type AtprotoDidResolver,
  RepoGapError,
  SpaceClient,
  SpaceReader,
  SpaceRepoVerificationError,
  delegationTokenProviderFor,
  listSpaces,
} from '../src/index.js'
import { com } from '../src/lexicons/index.js'
import {
  collect,
  createGroup,
  createUser,
  group,
  note,
  nsidOf,
  recordCalls,
  rkeyOf,
} from './_util.js'

const { authorizeSpaceSync, defs } = com.atproto.space

const other = l.record(
  'tid',
  'com.example.otherNote',
  l.object({ text: l.string() }),
)

const bookmarks = l.space('literal:self', 'com.example.bookmarks', [])

describe('SpaceClient', () => {
  let network: TestNetworkNoAppView
  let didResolver: AtprotoDidResolver
  let alice: Client // space authority, on the main PDS
  let bob: Client // member, on another PDS
  let carol: Client // not a member
  let space: SpaceRefString
  let aliceNoteRkey: string

  const open = (
    user: Client,
    uri: SpaceRefString = space,
    options?: Omit<SpaceClient.OpenSpaceOptions, 'agent'>,
  ) =>
    SpaceClient.openSpace(group, uri, {
      agent: user.agent,
      didResolver,
      ...options,
    })

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({ extraPdses: 1 })
    didResolver = createDidResolver({
      plcDirectoryUrl: network.plc.url,
      allowHttp: true,
    })

    alice = await createUser(network.pds, 'alice.test')
    bob = await createUser(network.extraPdses[0], 'bob.test2')
    carol = await createUser(network.pds, 'carol.test')

    space = await createGroup(alice, [bob])
    const { uri } = await open(alice).create(note, { text: 'from alice' })
    aliceNoteRkey = rkeyOf(uri)
    await open(bob).create(note, { text: 'from bob' })
  })

  afterAll(async () => {
    await network?.close()
  })

  it("lists the user's spaces from their PDS", async () => {
    const { spaces } = await bob.call(listSpaces)
    expect(spaces.map((s) => s.space)).toContain(space)
  })

  describe('createSpace', () => {
    it('creates a space and opens it', async () => {
      const created = await SpaceClient.createSpace(alice.agent, group, {
        skey: 'created',
        policy: com.atproto.memberspace.policy.$build({}),
      })
      expect(created).toBeInstanceOf(SpaceClient)
      expect(created.uri).toBe(
        `at://${alice.assertDid}/space/${group.nsid}/created`,
      )

      await created.create(note, { text: 'first' })
      const { records } = await created.list(note)
      expect(records.map((r) => r.value)).toEqual([
        note.$build({ text: 'first' }),
      ])
    })

    it('defaults the key of a literal key type', async () => {
      const created = await SpaceClient.createSpace(alice.agent, bookmarks, {
        policy: com.atproto.personalspace.policy.$build({}),
      })
      expect(created.ref.skey).toBe('self')
    })

    it('lets the PDS generate any other key', async () => {
      const created = await SpaceClient.createSpace(alice.agent, group, {
        policy: com.atproto.memberspace.policy.$build({}),
      })
      expect(isValidTid(created.ref.skey)).toBe(true)
    })
  })

  describe('openSpace', () => {
    it('refuses a space of another type', () => {
      const forum = l.space('any', 'com.example.forum', [])
      expect(() =>
        SpaceClient.openSpace(forum, space, { agent: bob.agent }),
      ).toThrow(TypeError)
      expect(() => SpaceReader.openSpace(forum, space)).toThrow(TypeError)
    })

    it('opens a space by its authority and key', () => {
      const { skey } = SpaceRef.parse(space)
      const opened = SpaceClient.openSpace(
        group,
        { authority: alice.assertDid, skey },
        { agent: bob.agent },
      )
      expect(opened.uri).toBe(space)
    })

    it('defaults the key of a literal key type', () => {
      const opened = SpaceClient.openSpace(
        bookmarks,
        { authority: alice.assertDid },
        { agent: bob.agent },
      )
      expect(opened.uri).toBe(
        `at://${alice.assertDid}/space/${bookmarks.nsid}/self`,
      )
    })
  })

  describe("the user's own repo", () => {
    it('is read and written through their agent, without a space credential', async () => {
      const uri = await createGroup(alice, [bob])
      const calls = recordCalls()
      // No didResolver either: resolving an identity would use `fetch`
      const bobSpace = SpaceClient.openSpace(group, uri, {
        agent: bob.agent,
        fetch: calls.fetch,
      })

      const rkey = rkeyOf((await bobSpace.create(note, { text: 'new' })).uri)
      await bobSpace.put(note, { text: 'updated' }, { rkey })
      expect(await bobSpace.get(note, { rkey })).toMatchObject({
        value: note.$build({ text: 'updated' }),
      })

      await bobSpace.applyWrites((op) => [
        op.delete(note, { rkey }),
        op.create(note, { text: 'batched' }),
      ])
      const { records } = await bobSpace.list(note)
      expect(records.map((r) => r.value)).toEqual([
        note.$build({ text: 'batched' }),
      ])

      await bobSpace.clearRecords()
      expect(await collect(bobSpace.listAll(note))).toEqual([])

      expect(calls.requests).toEqual([])
    })
  })

  describe('collections', () => {
    it('refuses undeclared collections unless validateRequest is false', async () => {
      const aliceSpace = open(alice, await createGroup(alice))
      const undeclared = new TypeError(
        `${other.$type} is not a collection of ${group.nsid} spaces`,
      )

      await expect(
        // @ts-expect-error not a collection of the space type
        aliceSpace.create(other, { text: 'refused' }),
      ).rejects.toThrow(undeclared)
      await expect(
        // @ts-expect-error not a collection of the space type
        aliceSpace.list(other),
      ).rejects.toThrow(undeclared)
      await expect(
        // @ts-expect-error not a collection of the space type
        aliceSpace.allRecords({ collections: [other] }).next(),
      ).rejects.toThrow(undeclared)

      const allowed = other.$build({ text: 'allowed' })
      await aliceSpace.create(
        other,
        { text: 'allowed' },
        { validateRequest: false },
      )
      const { records } = await aliceSpace.list(other, {
        validateRequest: false,
      })
      expect(records.map((r) => r.value)).toEqual([allowed])
      expect(
        await collect(
          aliceSpace.allRecords({
            collections: [other],
            validateRequest: false,
          }),
        ),
      ).toEqual([expect.objectContaining({ valid: true, record: allowed })])
    })

    it('flags the records of undeclared collections', async () => {
      const aliceSpace = open(alice, await createGroup(alice))
      await aliceSpace.create(note, { text: 'declared' })
      await aliceSpace.createRecord(other.$build({ text: 'undeclared' }))

      const records = await collect(aliceSpace.allRecords())
      expect(records).toHaveLength(2)
      expect(records).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            valid: true,
            record: note.$build({ text: 'declared' }),
          }),
          expect.objectContaining({
            valid: false,
            record: other.$build({ text: 'undeclared' }),
          }),
        ]),
      )
    })
  })

  describe('other repos', () => {
    it("reads a member's repo on another PDS", async () => {
      const bobSpace = open(bob)
      const fromAlice = note.$build({ text: 'from alice' })

      const { records } = await bobSpace.list(note, { repo: alice.assertDid })
      expect(records.map((r) => r.value)).toEqual([fromAlice])

      const record = await bobSpace.get(note, {
        repo: alice.assertDid,
        rkey: aliceNoteRkey,
      })
      expect(record.value).toEqual(fromAlice)
    })

    it('lists the writer set from the space host', async () => {
      expect(await collect(open(bob).writers())).toEqual([
        expect.objectContaining({
          $type: defs.repoWrite.$type,
          repo: alice.assertDid,
        }),
        expect.objectContaining({
          $type: defs.repoWrite.$type,
          repo: bob.assertDid,
        }),
      ])
    })

    it('sends the caller headers with the MAC request', async () => {
      const calls = recordCalls()
      await open(bob, space, { fetch: calls.fetch }).get(note, {
        repo: alice.assertDid,
        rkey: aliceNoteRkey,
        headers: async () => ({ 'x-caller': 'yes' }),
      })

      const [request] = calls.to(com.atproto.space.getRecord)
      expect(request.headers.get('x-caller')).toBe('yes')
      expect(request.headers.has('accept-signature')).toBe(true)
    })

    it.each([
      {
        method: com.atproto.space.getRecord,
        read: (s: SpaceClient<typeof group>) =>
          s.get(note, { repo: alice.assertDid, rkey: aliceNoteRkey }),
      },
      {
        method: com.atproto.space.getLatestCommit,
        read: (s: SpaceClient<typeof group>) =>
          s.getLatestCommit({ repo: alice.assertDid }),
      },
      {
        method: com.atproto.space.listRepoOps,
        read: (s: SpaceClient<typeof group>) =>
          s.listRepoOps({ repo: alice.assertDid }),
      },
      {
        method: com.atproto.space.getRepo,
        read: (s: SpaceClient<typeof group>) =>
          s.getRepoSnapshot({ repo: alice.assertDid }),
      },
    ])(
      'rejects a $method.$lxm response without a MAC, after one retry',
      async ({ method, read }) => {
        const calls = recordCalls(async (request) => {
          const response = await globalThis.fetch(request)
          const headers = new Headers(response.headers)
          headers.delete('signature')
          return new Response(response.body, {
            status: response.status,
            headers,
          })
        })

        await expect(
          read(open(bob, space, { fetch: calls.fetch })),
        ).rejects.toBeInstanceOf(SpaceRepoVerificationError)
        // Retried in case the author's KEM key was rotated
        expect(calls.to(method)).toHaveLength(2)
      },
    )
  })

  describe('space-wide reads', () => {
    it("iterates over a repo's records across pages", async () => {
      const uri = await createGroup(alice, [bob])
      await open(bob, uri).create(note, { text: 'one' })
      await open(bob, uri).create(note, { text: 'two' })

      const records = await collect(
        open(alice, uri).listAll(note, { repo: bob.assertDid, limit: 1 }),
      )
      expect(records.map((r) => r.value)).toEqual(
        expect.arrayContaining([
          note.$build({ text: 'one' }),
          note.$build({ text: 'two' }),
        ]),
      )
      expect(records).toHaveLength(2)
    })

    it('iterates over the records of every writer', async () => {
      const records = await collect(
        open(alice).allRecords({ collections: [note] }),
      )
      expectTypeOf<(typeof records)[number]['collection']>().toEqualTypeOf<
        typeof note.$type
      >()
      expect(records).toEqual([
        expect.objectContaining({
          repo: alice.assertDid,
          valid: true,
          record: note.$build({ text: 'from alice' }),
        }),
        expect.objectContaining({
          repo: bob.assertDid,
          valid: true,
          record: note.$build({ text: 'from bob' }),
        }),
      ])
    })

    it('skips repos removed from the writer set', async () => {
      const uri = await createGroup(alice, [bob])
      await open(alice, uri).create(note, { text: 'from alice' })
      await open(bob, uri).create(note, { text: 'from bob' })
      await alice.call(com.atproto.space.removeWriter, {
        space: uri,
        repo: bob.assertDid,
      })

      const records = await collect(open(alice, uri).allRecords())
      expect(records.map((r) => r.repo)).toEqual([alice.assertDid])
    })
  })

  describe('repo sync', () => {
    it('verifies the latest commit of a repo', async () => {
      const { body } = await open(alice).getLatestCommit({
        repo: bob.assertDid,
      })
      expect(body.commit).toMatchObject({ repo: bob.assertDid, space })
    })

    it('pulls a repo in full, then incrementally', async () => {
      const uri = await createGroup(alice, [bob])
      const bobSpace = open(bob, uri)
      await bobSpace.create(note, { text: 'kept' })
      const updated = rkeyOf(
        (await bobSpace.create(note, { text: 'before' })).uri,
      )
      const aliceSpace = open(alice, uri)

      const snapshot = await aliceSpace.pullRepo({ repo: bob.assertDid })
      assert(snapshot.type === 'snapshot')
      const index = new Map(
        snapshot.records.map((r) => [`${r.collection}/${r.rkey}`, r.cid]),
      )
      expect(index.size).toBe(2)

      await bobSpace.put(note, { text: 'after' }, { rkey: updated })
      const created = rkeyOf(
        (await bobSpace.create(note, { text: 'created' })).uri,
      )
      const transient = await bobSpace.create(note, { text: 'transient' })
      await bobSpace.delete(note, { rkey: rkeyOf(transient.uri) })

      const pulled = await aliceSpace.pullRepo({
        repo: bob.assertDid,
        head: snapshot.head,
        lookup: (collection, rkey) => index.get(`${collection}/${rkey}`),
      })
      assert(pulled.type === 'changes')
      // The transient record, created then deleted, did not change
      expect(
        pulled.changes.map((c) => ({
          rkey: c.rkey,
          prev: c.prev?.toString() ?? null,
          record: c.record,
        })),
      ).toEqual(
        expect.arrayContaining([
          {
            rkey: updated,
            prev: index.get(`${note.$type}/${updated}`)?.toString(),
            record: note.$build({ text: 'after' }),
          },
          {
            rkey: created,
            prev: null,
            record: note.$build({ text: 'created' }),
          },
        ]),
      )
      expect(pulled.changes).toHaveLength(2)

      const full = await aliceSpace.getRepoSnapshot({ repo: bob.assertDid })
      expect(pulled.head).toEqual(full.head)
    })

    it('pulls a repo its host does not have as empty', async () => {
      const aliceSpace = open(alice)
      // Carol never wrote to the space
      expect(await aliceSpace.pullRepo({ repo: carol.assertDid })).toEqual({
        type: 'empty',
      })

      // Nor with a known state, e.g. of a repo since garbage collected
      const { head } = await aliceSpace.getRepoSnapshot({ repo: bob.assertDid })
      expect(
        await aliceSpace.pullRepo({
          repo: carol.assertDid,
          head,
          lookup: () => undefined,
        }),
      ).toEqual({ type: 'empty' })
    })

    it('falls back to a full pull when the known state diverged', async () => {
      const uri = await createGroup(alice, [bob])
      const bobSpace = open(bob, uri)
      const { uri: recordUri } = await bobSpace.create(note, { text: 'before' })
      const aliceSpace = open(alice, uri)

      const { head } = await aliceSpace.getRepoSnapshot({ repo: bob.assertDid })
      await bobSpace.put(note, { text: 'after' }, { rkey: rkeyOf(recordUri) })

      // A lookup missing the updated record diverges from the operation log
      const lookup = () => undefined
      await expect(
        aliceSpace.syncRepo({ repo: bob.assertDid, head, lookup }),
      ).rejects.toBeInstanceOf(RepoGapError)

      const pulled = await aliceSpace.pullRepo({
        repo: bob.assertDid,
        head,
        lookup,
      })
      assert(pulled.type === 'snapshot')
      expect(pulled.records.map((r) => r.record)).toEqual([
        note.$build({ text: 'after' }),
      ])
    })
  })

  describe('blobs', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5])
    let blobSpace: SpaceRefString
    let cid: CidString

    beforeAll(async () => {
      blobSpace = await createGroup(alice, [bob])
      const { body } = await alice.uploadBlob(bytes, { encoding: 'image/png' })
      cid = getBlobCidString(body.blob) as CidString
      await open(alice, blobSpace).createRecord({
        $type: note.$type,
        text: 'with a blob',
        image: body.blob,
      })
    })

    it('gets blobs verified against their CID', async () => {
      const bobSpace = open(bob, blobSpace)

      const { body } = await bobSpace.getBlob({ repo: alice.assertDid, cid })
      expect(body).toEqual(bytes)

      const listed = await bobSpace.listBlobs({ repo: alice.assertDid })
      expect(listed.body.cids).toEqual([cid])
    })

    it('rejects a blob that does not match its CID', async () => {
      const calls = recordCalls(async (request) => {
        const response = await globalThis.fetch(request)
        if (nsidOf(request) !== com.atproto.space.getBlob.$lxm) return response
        return new Response(new Uint8Array([6, 6, 6]), {
          status: response.status,
          headers: response.headers,
        })
      })

      await expect(
        open(bob, blobSpace, { fetch: calls.fetch }).getBlob({
          repo: alice.assertDid,
          cid,
        }),
      ).rejects.toBeInstanceOf(SpaceRepoVerificationError)
    })
  })

  describe('credentials', () => {
    it('mints one credential for concurrent requests, and reuses it', async () => {
      const calls = recordCalls()
      const bobSpace = open(bob, space, { fetch: calls.fetch })

      await Promise.all([
        bobSpace.list(note, { repo: alice.assertDid }),
        bobSpace.listWriters(),
      ])
      await bobSpace.list(note, { repo: alice.assertDid })

      expect(calls.to(authorizeSpaceSync)).toHaveLength(1)
    })

    it('authorizes early, and renews on demand', async () => {
      const calls = recordCalls()
      const bobSpace = open(bob, space, { fetch: calls.fetch })

      const credential = await bobSpace.authorize()
      expect(credential.spaceRev).toEqual(expect.any(String))
      expect(await bobSpace.authorize()).toBe(credential)

      const renewed = await bobSpace.authorize({ renew: true })
      expect(renewed.token).not.toBe(credential.token)
      expect(calls.to(authorizeSpaceSync)).toHaveLength(2)
    })

    it('retries a refused mint instead of caching it', async () => {
      const calls = recordCalls()
      const carolSpace = open(carol, space, { fetch: calls.fetch })

      await expect(carolSpace.authorize()).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
      await expect(carolSpace.listWriters()).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
      expect(calls.to(authorizeSpaceSync)).toHaveLength(2)
    })
  })

  describe('SpaceReader', () => {
    it('reads with a delegation token provider', async () => {
      const reader = SpaceReader.openSpace(group, space, {
        didResolver,
        delegationTokenProvider: delegationTokenProviderFor(bob.agent),
      })

      const { body } = await reader.listRecords({ repo: alice.assertDid })
      expect(body.records.map((r) => r.value)).toEqual([
        note.$build({ text: 'from alice' }),
      ])
    })

    it('reads a public space without a delegation token', async () => {
      const publicSpace = await createGroup(
        alice,
        [],
        com.atproto.memberspace.policy.$build({ publicRead: true }),
      )
      await open(alice, publicSpace).create(note, { text: 'for anyone' })

      const reader = SpaceReader.openSpace(group, publicSpace, { didResolver })

      const { records } = await reader.getRepoSnapshot({
        repo: alice.assertDid,
      })
      expect(records.map((r) => r.record)).toEqual([
        note.$build({ text: 'for anyone' }),
      ])
    })
  })
})
