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
import {
  type CidString,
  type Client,
  XrpcResponseError,
} from '@atproto/lex-client'
import { type Cid, getBlobCidString } from '@atproto/lex-data'
import { l } from '@atproto/lex-schema'
import type { SpaceRefString } from '@atproto/syntax'
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
import { createUser, processNotifications } from './_util.js'

const note = l.record(
  'tid',
  'com.example.spaceNote',
  l.object({ text: l.string() }),
)

const group = l.space('any', 'com.example.group', [note.$type], {
  title: 'Example group',
})

const AUTHORIZE_SPACE_SYNC = `/xrpc/${com.atproto.space.authorizeSpaceSync.$lxm}`

describe('SpaceClient', () => {
  let network: TestNetworkNoAppView
  let didResolver: AtprotoDidResolver
  let alice: Client // space authority, on the main PDS
  let bob: Client // member, on another PDS
  let carol: Client // not a member
  let space: SpaceRefString
  let aliceNoteRkey: string

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({ extraPdses: 1 })
    didResolver = createDidResolver({
      plcDirectoryUrl: network.plc.url,
      allowHttp: true,
    })

    alice = await createUser(network.pds, 'alice.test')
    bob = await createUser(network.extraPdses[0], 'bob.test2')
    carol = await createUser(network.pds, 'carol.test')

    space = await setupSpace(alice, 'main', [bob])

    const aliceSpace = SpaceClient.openSpace(group, space, {
      agent: alice.agent,
      didResolver,
    })
    const { uri } = await aliceSpace.create(note, { text: 'from alice' })
    aliceNoteRkey = uri.split('/').pop()!

    const bobSpace = SpaceClient.openSpace(group, space, {
      agent: bob.agent,
      didResolver,
    })
    await bobSpace.create(note, { text: 'from bob' })
  })

  afterAll(async () => {
    await network?.close()
  })

  describe('listSpaces', () => {
    it('lists the spaces the user is the authority of', async () => {
      const { spaces } = await alice.call(listSpaces)
      expect(spaces.map((s) => s.space)).toContain(space)
    })

    it('lists the spaces the user holds a repo in', async () => {
      const { spaces } = await bob.call(listSpaces)
      expect(spaces.map((s) => s.space)).toContain(space)
    })

    it('lists only the spaces the user is the authority of', async () => {
      const aliceSpaces = await alice.call(listSpaces, { spaceDid: alice.did })
      expect(aliceSpaces.spaces.map((s) => s.space)).toContain(space)

      const bobSpaces = await bob.call(listSpaces, { spaceDid: bob.did })
      expect(bobSpaces.spaces).toEqual([])
    })
  })

  describe('createSpace', () => {
    it('creates a space, and opens it', async () => {
      const created = await SpaceClient.createSpace(
        alice.agent,
        group,
        { skey: 'created', policy: com.atproto.memberspace.policy.$build({}) },
        { didResolver },
      )
      expect(created).toBeInstanceOf(SpaceClient)
      expect(created.uri).toBe(
        `at://${alice.assertDid}/space/com.example.group/created`,
      )

      await created.create(note, { text: 'first' })
      const { records } = await created.list(note)
      expect(records.map((r) => r.value)).toEqual([
        note.$build({ text: 'first' }),
      ])

      const { spaces } = await alice.call(listSpaces, { spaceDid: alice.did })
      expect(spaces.map((s) => s.space)).toContain(created.uri)
    })

    it('generates the space key when omitted', async () => {
      const created = await SpaceClient.createSpace(alice.agent, group, {
        policy: com.atproto.memberspace.policy.$build({}),
      })
      expect(created.ref.skey).toMatch(/^[a-z2-7]{13}$/)
    })

    it('refuses to create a space that already exists', async () => {
      await expect(
        SpaceClient.createSpace(alice.agent, group, {
          skey: 'main',
          policy: com.atproto.memberspace.policy.$build({}),
        }),
      ).rejects.toMatchObject({ error: 'SpaceAlreadyExists' })
    })
  })

  describe("the user's own repo", () => {
    it("is read through the user's PDS", async () => {
      const bobSpace = SpaceClient.openSpace(group, space, { agent: bob.agent })
      const { records } = await bobSpace.list(note)
      expect(records).toEqual([
        expect.objectContaining({
          valid: true,
          value: note.$build({ text: 'from bob' }),
        }),
      ])
    })

    it('is read and written without a space credential', async () => {
      const writesSpace = await setupSpace(alice, 'writes', [bob])
      const calls = recordCalls()
      const bobSpace = SpaceClient.openSpace(group, writesSpace, {
        agent: bob.agent,
        didResolver,
        fetch: calls.fetch,
      })

      const { uri } = await bobSpace.create(note, { text: 'created' })
      const rkey = uri.split('/').pop()!
      await bobSpace.put(note, { text: 'updated' }, { rkey })
      expect((await bobSpace.get(note, { rkey })).value.text).toBe('updated')

      await bobSpace.applyWrites((op) => [
        op.delete(note, { rkey }),
        op.create(note, { text: 'batched' }),
      ])
      const listed = await bobSpace.list(note)
      expect(listed.records.map((r) => r.value)).toEqual([
        note.$build({ text: 'batched' }),
      ])

      await bobSpace.clearRecords()
      expect((await bobSpace.list(note)).records).toEqual([])

      expect(calls.paths).toEqual([])
    })
  })

  describe('other repos', () => {
    it("reads another member's repo on another PDS", async () => {
      const bobSpace = SpaceClient.openSpace(group, space, {
        agent: bob.agent,
        didResolver,
      })

      const { records } = await bobSpace.list(note, { repo: alice.assertDid })
      expect(records.map((r) => r.value)).toEqual([
        note.$build({ text: 'from alice' }),
      ])

      const record = await bobSpace.get(note, {
        repo: alice.assertDid,
        rkey: aliceNoteRkey,
      })
      expect(record.value).toEqual(note.$build({ text: 'from alice' }))
    })

    it('lets the authority read members on other PDSes', async () => {
      const aliceSpace = SpaceClient.openSpace(group, space, {
        agent: alice.agent,
        didResolver,
      })
      const { records } = await aliceSpace.list(note, { repo: bob.assertDid })
      expect(records.map((r) => r.value)).toEqual([
        note.$build({ text: 'from bob' }),
      ])
    })

    it('lists the writer set from the space host', async () => {
      const bobSpace = SpaceClient.openSpace(group, space, {
        agent: bob.agent,
        didResolver,
      })
      await processNotifications(network)

      const { body } = await bobSpace.listWriters()
      expect(body.repos.map((r) => r.repo)).toContain(bob.assertDid)
    })

    it('mints a single space credential on first use, and reuses it', async () => {
      const calls = recordCalls()
      const bobSpace = SpaceClient.openSpace(group, space, {
        agent: bob.agent,
        didResolver,
        fetch: calls.fetch,
      })

      await Promise.all([
        bobSpace.list(note, { repo: alice.assertDid }),
        bobSpace.listWriters(),
      ])
      await bobSpace.list(note, { repo: alice.assertDid })

      expect(calls.paths).toHaveLength(4)
      expect(calls.paths.filter((p) => p === AUTHORIZE_SPACE_SYNC)).toEqual([
        AUTHORIZE_SPACE_SYNC,
      ])
    })

    it('refuses users the space does not grant access to', async () => {
      const calls = recordCalls()
      const carolSpace = SpaceClient.openSpace(group, space, {
        agent: carol.agent,
        didResolver,
        fetch: calls.fetch,
      })

      for (let i = 0; i < 2; i++) {
        const result = carolSpace.listWriters()
        await expect(result).rejects.toBeInstanceOf(XrpcResponseError)
        await expect(result).rejects.toMatchObject({ error: 'SpaceNotFound' })
      }
      // A failed mint is retried rather than cached
      expect(calls.paths).toEqual([AUTHORIZE_SPACE_SYNC, AUTHORIZE_SPACE_SYNC])
    })

    it('sends the caller headers along with the MAC request', async () => {
      const received: Headers[] = []
      const bobSpace = SpaceClient.openSpace(group, space, {
        agent: bob.agent,
        didResolver,
        fetch: (input, init) => {
          const request = new Request(input, init)
          const { pathname } = new URL(request.url)
          if (pathname === `/xrpc/${com.atproto.space.getRecord.$lxm}`) {
            received.push(request.headers)
          }
          return globalThis.fetch(request)
        },
      })

      await bobSpace.get(note, {
        repo: alice.assertDid,
        rkey: aliceNoteRkey,
        headers: async () => ({ 'x-caller': 'yes' }),
      })

      expect(received).toHaveLength(1)
      expect(received[0].get('x-caller')).toBe('yes')
      expect(received[0].get('accept-signature')).toMatch(
        /;tag="atproto-space-record"/,
      )
    })

    it('rejects records that fail MAC verification', async () => {
      let getRecordCalls = 0
      const bobSpace = SpaceClient.openSpace(group, space, {
        agent: bob.agent,
        didResolver,
        fetch: async (input, init) => {
          const response = await globalThis.fetch(input, init)
          const { pathname } = new URL(new Request(input).url)
          if (pathname !== `/xrpc/${com.atproto.space.getRecord.$lxm}`) {
            return response
          }
          getRecordCalls++
          // Keep the label, but replace the MAC
          const headers = new Headers(response.headers)
          const zeros = Buffer.alloc(32).toString('base64')
          headers.set(
            'signature',
            headers.get('signature')!.replace(/:[^:]*:/, `:${zeros}:`),
          )
          return new Response(response.body, {
            status: response.status,
            headers,
          })
        },
      })

      await expect(
        bobSpace.get(note, { repo: alice.assertDid, rkey: aliceNoteRkey }),
      ).rejects.toBeInstanceOf(SpaceRepoVerificationError)
      // Retried once, with the author's KEM key re-resolved
      expect(getRecordCalls).toBe(2)
    })
  })

  describe('space-wide reads', () => {
    it('iterates over the writer set', async () => {
      const bobSpace = SpaceClient.openSpace(group, space, {
        agent: bob.agent,
        didResolver,
      })
      await processNotifications(network)

      const dids: string[] = []
      for await (const { repo } of bobSpace.writers()) dids.push(repo)
      expect(dids).toContain(bob.assertDid)
    })

    it("iterates over a repo's records", async () => {
      const bobSpace = SpaceClient.openSpace(group, space, {
        agent: bob.agent,
        didResolver,
      })

      const values: unknown[] = []
      for await (const record of bobSpace.listAll(note, {
        repo: alice.assertDid,
      })) {
        values.push(record.value)
      }
      expect(values).toEqual([note.$build({ text: 'from alice' })])
    })

    it('iterates over the verified records of every writer', async () => {
      const aliceSpace = SpaceClient.openSpace(group, space, {
        agent: alice.agent,
        didResolver,
      })
      await processNotifications(network)

      const writers = new Set<string>()
      for await (const { repo } of aliceSpace.writers()) writers.add(repo)

      const records = []
      for await (const record of aliceSpace.allRecords({
        collections: [note],
      })) {
        expectTypeOf(record.collection).toEqualTypeOf<typeof note.$type>()
        records.push(record)
      }
      expect(new Set(records.map((r) => r.repo))).toEqual(writers)
      expect(records).toContainEqual(
        expect.objectContaining({
          repo: bob.assertDid,
          valid: true,
          record: note.$build({ text: 'from bob' }),
        }),
      )
    })
  })

  describe('space type', () => {
    const other = l.record(
      'tid',
      'com.example.otherNote',
      l.object({ text: l.string() }),
    )

    it('refuses spaces of another type', () => {
      const forum = l.space('any', 'com.example.forum', [], { title: 'Forum' })
      expect(() =>
        SpaceClient.openSpace(forum, space, { agent: bob.agent }),
      ).toThrow(TypeError)
      expect(() => SpaceReader.openSpace(forum, space)).toThrow(TypeError)
    })

    it('opens a space by its authority and key', async () => {
      const ref: SpaceReader.AuthorityRef<typeof group> = {
        authority: alice.assertDid,
        skey: 'main',
      }

      const bobSpace = SpaceClient.openSpace(group, ref, {
        agent: bob.agent,
        didResolver,
      })
      expect(bobSpace.uri).toBe(space)
      const { records } = await bobSpace.list(note, { repo: alice.assertDid })
      expect(records.map((r) => r.value)).toEqual([
        note.$build({ text: 'from alice' }),
      ])
    })

    it('defaults the key of space types with a literal key', async () => {
      const bookmarks = l.space('literal:self', 'com.example.bookmarks', [], {
        title: 'Bookmarks',
      })
      const created = await SpaceClient.createSpace(alice.agent, bookmarks, {
        policy: com.atproto.personalspace.policy.$build({}),
      })
      expect(created.ref.skey).toBe('self')

      const opened = SpaceClient.openSpace(
        bookmarks,
        { authority: alice.assertDid },
        { agent: alice.agent },
      )
      expect(opened.uri).toBe(created.uri)
    })

    it('restricts the typed reads and writes to its collections', async () => {
      const uri = await setupSpace(alice, 'collections', [])
      const aliceSpace = SpaceClient.openSpace(group, uri, {
        agent: alice.agent,
      })

      await expect(
        // @ts-expect-error not a collection of the space type
        aliceSpace.create(other, { text: 'refused' }),
      ).rejects.toThrow(TypeError)
      await expect(
        // @ts-expect-error not a collection of the space type
        aliceSpace.list(other),
      ).rejects.toThrow(TypeError)

      await aliceSpace.create(
        other,
        { text: 'allowed' },
        { validateRequest: false },
      )
      const { records } = await aliceSpace.list(other, {
        validateRequest: false,
      })
      expect(records.map((r) => r.value)).toEqual([
        other.$build({ text: 'allowed' }),
      ])

      // The lower level methods accept any record
      await aliceSpace.createRecord(other.$build({ text: 'raw' }))
    })

    it('flags the records of undeclared collections', async () => {
      const uri = await setupSpace(alice, 'flags', [])
      const aliceSpace = SpaceClient.openSpace(group, uri, {
        agent: alice.agent,
        didResolver,
      })
      await aliceSpace.create(note, { text: 'declared' })
      await aliceSpace.createRecord(other.$build({ text: 'undeclared' }))
      await processNotifications(network)

      const all = []
      for await (const record of aliceSpace.allRecords()) all.push(record)
      expect(all).toHaveLength(2)
      expect(all).toContainEqual(
        expect.objectContaining({
          valid: true,
          record: note.$build({ text: 'declared' }),
        }),
      )
      expect(all).toContainEqual(
        expect.objectContaining({
          valid: false,
          record: other.$build({ text: 'undeclared' }),
        }),
      )

      const others = []
      for await (const record of aliceSpace.allRecords({
        collections: [other],
        validateRequest: false,
      })) {
        others.push(record)
      }
      expect(others).toEqual([
        expect.objectContaining({
          valid: true,
          record: other.$build({ text: 'undeclared' }),
        }),
      ])

      await expect(
        // @ts-expect-error not a collection of the space type
        aliceSpace.allRecords({ collections: [other] }).next(),
      ).rejects.toThrow(TypeError)
    })
  })

  describe('repo sync', () => {
    it('verifies the latest commit of a repo', async () => {
      const aliceSpace = SpaceClient.openSpace(group, space, {
        agent: alice.agent,
        didResolver,
      })
      const { body } = await aliceSpace.getLatestCommit({
        repo: bob.assertDid,
      })
      expect(body.commit).toMatchObject({ repo: bob.assertDid, space })
    })

    it('verifies the commit on every page of the operation log', async () => {
      const aliceSpace = SpaceClient.openSpace(group, space, {
        agent: alice.agent,
        didResolver,
      })
      const latest = await aliceSpace.getLatestCommit({ repo: bob.assertDid })
      const { body } = await aliceSpace.listRepoOps({
        repo: bob.assertDid,
        limit: 1,
      })
      // A full page, so not necessarily the last
      expect(body.ops).toHaveLength(1)
      expect(body.cursor).toBeDefined()
      expect(body.commit).toEqual(latest.body.commit)
    })

    it('pulls a repo in full, then incrementally', async () => {
      const syncSpace = await setupSpace(alice, 'sync', [bob])
      const bobSpace = SpaceClient.openSpace(group, syncSpace, {
        agent: bob.agent,
      })
      await bobSpace.create(note, { text: 'kept' })
      const updated = await bobSpace.create(note, { text: 'before' })
      const aliceSpace = SpaceClient.openSpace(group, syncSpace, {
        agent: alice.agent,
        didResolver,
      })

      const index = new Map<string, Cid>()
      const lookup = (collection: string, rkey: string) =>
        index.get(`${collection}/${rkey}`)
      let head: SpaceReader.RepoHead | undefined = undefined
      // In a loop, the head is known only after the first pull
      expectTypeOf(aliceSpace.pullRepo).toBeCallableWith({
        repo: bob.assertDid,
        head: head as SpaceReader.RepoHead | undefined,
        lookup,
      })

      // No known state: pulled in full
      const snapshot = await aliceSpace.pullRepo({
        repo: bob.assertDid,
        head,
        lookup,
      })
      assert(snapshot.type === 'snapshot')
      for (const r of snapshot.records) {
        index.set(`${r.collection}/${r.rkey}`, r.cid)
      }
      expect(index.size).toBe(2)
      head = snapshot.head

      const updatedRkey = rkeyOf(updated.uri)
      await bobSpace.put(note, { text: 'after' }, { rkey: updatedRkey })
      const created = await bobSpace.create(note, { text: 'created' })
      const transient = await bobSpace.create(note, { text: 'transient' })
      await bobSpace.delete(note, { rkey: rkeyOf(transient.uri) })

      const pulled = await aliceSpace.pullRepo({
        repo: bob.assertDid,
        head,
        lookup,
      })
      assert(pulled.type === 'changes')
      const changes = pulled.changes.map((c) => ({
        rkey: c.rkey,
        prev: c.prev?.toString() ?? null,
        record: c.record,
      }))
      // The transient record, created then deleted, did not change
      expect(changes).toHaveLength(2)
      expect(changes).toContainEqual({
        rkey: updatedRkey,
        prev: index.get(`${note.$type}/${updatedRkey}`)?.toString(),
        record: note.$build({ text: 'after' }),
      })
      expect(changes).toContainEqual({
        rkey: rkeyOf(created.uri),
        prev: null,
        record: note.$build({ text: 'created' }),
      })

      // The resulting state is that of the repo
      const full = await aliceSpace.getRepoSnapshot({ repo: bob.assertDid })
      expect(pulled.head).toEqual(full.head)
    })

    it('falls back to a full sync when the known state diverged', async () => {
      const syncSpace = await setupSpace(alice, 'sync-gap', [bob])
      const bobSpace = SpaceClient.openSpace(group, syncSpace, {
        agent: bob.agent,
      })
      const { uri } = await bobSpace.create(note, { text: 'before' })
      const aliceSpace = SpaceClient.openSpace(group, syncSpace, {
        agent: alice.agent,
        didResolver,
      })

      const { head } = await aliceSpace.getRepoSnapshot({ repo: bob.assertDid })
      await bobSpace.put(note, { text: 'after' }, { rkey: rkeyOf(uri) })

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
      blobSpace = await setupSpace(alice, 'blobs', [bob])
      const { body } = await alice.uploadBlob(bytes, { encoding: 'image/png' })
      cid = getBlobCidString(body.blob) as CidString
      const aliceSpace = SpaceClient.openSpace(group, blobSpace, {
        agent: alice.agent,
      })
      await aliceSpace.createRecord({
        $type: note.$type,
        text: 'with a blob',
        image: body.blob,
      })
    })

    it('gets blobs verified against their CID', async () => {
      const bobSpace = SpaceClient.openSpace(group, blobSpace, {
        agent: bob.agent,
        didResolver,
      })

      const { body } = await bobSpace.getBlob({ repo: alice.assertDid, cid })
      expect(body).toEqual(bytes)

      const listed = await bobSpace.listBlobs({ repo: alice.assertDid })
      expect(listed.body.cids).toEqual([cid])
    })

    it('rejects blobs that do not match their CID', async () => {
      const bobSpace = SpaceClient.openSpace(group, blobSpace, {
        agent: bob.agent,
        didResolver,
        fetch: async (input, init) => {
          const response = await globalThis.fetch(input, init)
          const { pathname } = new URL(new Request(input).url)
          if (pathname !== `/xrpc/${com.atproto.space.getBlob.$lxm}`) {
            return response
          }
          return new Response(new Uint8Array([6, 6, 6]), {
            status: response.status,
            headers: response.headers,
          })
        },
      })

      await expect(
        bobSpace.getBlob({ repo: alice.assertDid, cid }),
      ).rejects.toBeInstanceOf(SpaceRepoVerificationError)
    })
  })

  describe('credentials', () => {
    it('authorizes early, and renews on demand', async () => {
      const calls = recordCalls()
      const bobSpace = SpaceClient.openSpace(group, space, {
        agent: bob.agent,
        didResolver,
        fetch: calls.fetch,
      })

      const credential = await bobSpace.authorize()
      expect(await bobSpace.authorize()).toBe(credential)

      const renewed = await bobSpace.authorize({ renew: true })
      expect(renewed.token).not.toBe(credential.token)
      expect(calls.paths).toEqual([AUTHORIZE_SPACE_SYNC, AUTHORIZE_SPACE_SYNC])
    })

    it('fails early when the space does not grant access', async () => {
      const carolSpace = SpaceClient.openSpace(group, space, {
        agent: carol.agent,
        didResolver,
      })
      await expect(carolSpace.authorize()).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
    })

    it('renews a rejected credential once', async () => {
      const calls = recordCalls()
      let rejected = false
      const bobSpace = SpaceClient.openSpace(group, space, {
        agent: bob.agent,
        didResolver,
        fetch: async (input, init) => {
          const { pathname } = new URL(new Request(input).url)
          if (
            !rejected &&
            pathname === `/xrpc/${com.atproto.space.listWriters.$lxm}`
          ) {
            rejected = true
            return Response.json(
              { error: 'AuthenticationRequired', message: 'Revoked' },
              { status: 401 },
            )
          }
          return calls.fetch(input, init)
        },
      })

      await bobSpace.listWriters()
      expect(calls.paths.filter((p) => p === AUTHORIZE_SPACE_SYNC)).toEqual([
        AUTHORIZE_SPACE_SYNC,
        AUTHORIZE_SPACE_SYNC,
      ])
    })
  })

  describe('SpaceReader', () => {
    it('reads a space with delegation tokens provided by other means', async () => {
      const reader = SpaceReader.openSpace(group, space, {
        didResolver,
        delegationTokenProvider: delegationTokenProviderFor(bob.agent),
      })

      const { body } = await reader.listRecords({ repo: alice.assertDid })
      expect(body.records.map((r) => r.value)).toEqual([
        note.$build({ text: 'from alice' }),
      ])
    })

    it('reads a public space without a user session', async () => {
      const publicSpace = await setupSpace(
        alice,
        'public',
        [],
        com.atproto.memberspace.policy.$build({ publicRead: true }),
      )
      const aliceSpace = SpaceClient.openSpace(group, publicSpace, {
        agent: alice.agent,
      })
      await aliceSpace.create(note, { text: 'for anyone' })

      // No delegation token by default
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

function rkeyOf(uri: string): string {
  return uri.split('/').pop()!
}

async function setupSpace(
  authority: Client,
  skey: string,
  members: Client[],
  policy = com.atproto.memberspace.policy.$build({}),
): Promise<SpaceRefString> {
  const { space } = await authority.call(com.atproto.space.createSpace, {
    spaceType: 'com.example.group',
    skey,
    policy,
  })
  if (members.length) {
    await authority.call(com.atproto.memberspace.putMembers, {
      space,
      members: members.map((member) => ({
        did: member.assertDid,
        read: true,
        write: true,
      })),
    })
  }
  return space
}

/** Records the requests made to hosts other than the user's PDS. */
function recordCalls() {
  const paths: string[] = []
  const fetch: typeof globalThis.fetch = (input, init) => {
    paths.push(new URL(new Request(input).url).pathname)
    return globalThis.fetch(input, init)
  }
  return { paths, fetch }
}
