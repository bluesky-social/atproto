import { jest } from '@jest/globals'
import { MINUTE, TID, getVerificationMaterial } from '@atproto/common'
import type { TestNetworkNoAppView } from '@atproto/dev-env'
import { parseCid } from '@atproto/lex-data'
import {
  COMMIT_MAC_PROFILE,
  LtHash,
  RECORD_MAC_PROFILE,
  RepoCommit,
  encapsulate,
  formatMacRequest,
  spaceHostAud,
  verifyCommit,
  verifyRecord,
  verifyRepoStarFull,
} from '@atproto/space'
import type {
  DidString,
  SpaceAtUriString,
  SpaceRefString,
} from '@atproto/syntax'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import { com } from '../../src/lexicons/index.js'
import {
  type Actor,
  MockClientApp,
  MockService,
  type SpaceClient,
  type SpaceCredential,
  TEST_COLLECTION,
  TEST_COLLECTION_ALT,
  createSpaceNetwork,
  record,
} from '../_space.js'

const { repoWrite, repoRemoved } = com.atproto.space.defs

const createOp = (rkey: string) =>
  com.atproto.space.applyWrites.create.$build({
    collection: TEST_COLLECTION,
    rkey,
    value: record(TEST_COLLECTION, rkey),
  })

// Follow each cursor to the last page.
async function pageAll<T extends { cursor?: string }>(
  fetchPage: (cursor?: string) => Promise<T>,
): Promise<T[]> {
  const pages: T[] = []
  let cursor: string | undefined
  do {
    if (pages.length >= 20) throw new Error('pagination did not end')
    const page = await fetchPage(cursor)
    pages.push(page)
    cursor = page.cursor
  } while (cursor)
  return pages
}

// Apply oplog entries to a syncer's copy of a repo.
const replay = (
  ops: com.atproto.space.listRepoOps.OpEntry[],
  into = new RepoCommit(),
) =>
  into.applyOps(
    ops.map((op) => ({
      collection: op.collection,
      rkey: op.rkey,
      cid: op.cid ? parseCid(op.cid) : null,
      prev: op.prev ? parseCid(op.prev) : null,
    })),
  )

describe('space sync', () => {
  let network: TestNetworkNoAppView
  let sc: SpaceClient
  let alice: Actor
  let dan: Actor
  let bob: Actor
  let carol: Actor

  beforeAll(async () => {
    ;({ network, sc, alice, dan, bob, carol } = await createSpaceNetwork())
  })

  afterAll(async () => {
    await network?.close()
  })

  const listRepoOps = (
    actor: Actor,
    space: SpaceRefString,
    params: {
      since?: string
      cursor?: string
      limit?: number
      excludeValues?: boolean
    } = {},
  ) =>
    actor.client.call(
      com.atproto.space.listRepoOps,
      { space, repo: actor.did, ...params },
      { headers: actor.headers },
    )

  const listWriters = async (
    cred: SpaceCredential,
    space: SpaceRefString,
    params: { cursor?: string; limit?: number } = {},
  ) => {
    const res = await cred
      .clientFor(alice.pds)
      .call(com.atproto.space.listWriters, { space, ...params })
    // The union is open, so narrow it to the entries a writer set holds.
    const repos = res.repos.map((entry) => {
      if (repoWrite.$isTypeOf(entry)) return entry
      if (repoRemoved.$isTypeOf(entry)) return entry
      throw new Error(`Unexpected writer set entry: ${entry.$type}`)
    })
    return { ...res, repos }
  }

  // Download `host`'s repo as a STAR archive and verify it.
  const getRepo = async (
    cred: SpaceCredential,
    host: Actor,
    space: SpaceRefString,
  ) => {
    const params = { space, repo: host.did }
    const res = await cred
      .clientFor(host.pds)
      .xrpc(com.atproto.space.getRepo, { params })
    return verifyRepoStarFull([res.body], {
      ...params,
      ...cred.lastMacParams(),
    })
  }

  const kemKeyOf = async (actor: Actor): Promise<DidString> => {
    const doc = await sc.idResolver.did.ensureResolve(actor.did)
    const key = getVerificationMaterial(doc, 'atproto_kem')
    return `did:key:${key!.publicKeyMultibase}`
  }

  describe('listRepoOps', () => {
    it('resumes mid-rev from a cursor', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await dan.client.call(
        com.atproto.space.applyWrites,
        {
          space,
          repo: dan.did,
          writes: ['a', 'b', 'c', 'd', 'e'].map(createOp),
        },
        { headers: dan.headers },
      )

      const pages = await pageAll((cursor) =>
        listRepoOps(dan, space, { limit: 2, cursor }),
      )
      expect(pages.map((page) => page.ops.map((op) => op.rkey))).toEqual([
        ['a', 'b'],
        ['c', 'd'],
        ['e'],
      ])
    })

    it('composes since with cursor', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.write(dan, space, { rkey: 'synced' })
      const since = (await sc.latestCommit(dan, space))!.rev
      for (const rkey of ['a', 'b', 'c']) {
        await sc.write(dan, space, { rkey })
      }

      const pages = await pageAll((cursor) =>
        listRepoOps(dan, space, { since, cursor, limit: 1 }),
      )
      expect(pages.flatMap((page) => page.ops.map((op) => op.rkey))).toEqual([
        'a',
        'b',
        'c',
      ])
    })

    it('replays page by page to the commit, which every page carries with a MAC', async () => {
      const space = await sc.createSpace(alice, { members: [dan, carol] })
      await sc.write(dan, space, { rkey: 'one' })
      await sc.put(dan, space, { rkey: 'two', text: 'first' })
      await sc.put(dan, space, { rkey: 'two', text: 'revised' })
      await sc.del(dan, space, { rkey: 'one' })

      const cred = await sc.credentialFor(carol, space)
      const params = { space, repo: dan.did }
      const local = new RepoCommit()
      const pages = await pageAll(async (cursor) => {
        const page = await cred
          .clientFor(dan.pds)
          .call(com.atproto.space.listRepoOps, { ...params, cursor, limit: 1 })
        cred.verifyCommit(page.commit, params)
        replay(page.ops, local)
        return page
      })

      expect(pages.flatMap((page) => page.ops)).toHaveLength(4)
      expect(local.matches(pages.at(-1)!.commit)).toBe(true)
    })

    it("inlines only a record's current value", async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.put(dan, space, { rkey: 'self', text: 'first' })
      await sc.put(dan, space, { rkey: 'self', text: 'second' })

      const { ops } = await listRepoOps(dan, space)
      expect(ops).toHaveLength(2)
      expect(ops[0].value).toBeUndefined()
      expect(ops[1].value).toMatchObject({ text: 'second' })
    })

    it('omits values with excludeValues', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.write(dan, space, { rkey: 'no-value' })

      const { ops } = await listRepoOps(dan, space, { excludeValues: true })
      expect(ops).toHaveLength(1)
      expect(ops[0]).toMatchObject({ rkey: 'no-value' })
      expect(ops[0].value).toBeUndefined()
    })

    it('rejects a malformed cursor', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.write(dan, space)

      await expect(
        listRepoOps(dan, space, { cursor: 'not-a-cursor' }),
      ).rejects.toMatchObject({ error: 'InvalidCursor' })
    })
  })

  describe('full-state recovery', () => {
    it('rebuilds from listRecords to match getLatestCommit', async () => {
      const space = await sc.createSpace(alice, { members: [bob, carol] })
      for (const rkey of ['a', 'b', 'c', 'd', 'e']) {
        await sc.write(bob, space, { rkey })
      }

      const cred = await sc.credentialFor(carol, space)
      const client = cred.clientFor(bob.pds)
      const params = { space, repo: bob.did }
      const pages = await pageAll((cursor) =>
        client.call(com.atproto.space.listRecords, {
          ...params,
          limit: 2,
          cursor,
        }),
      )
      const records = pages.flatMap((page) => page.records)
      const { commit } = await client.call(
        com.atproto.space.getLatestCommit,
        params,
      )
      cred.verifyCommit(commit, params)

      expect(records).toHaveLength(5)
      const rebuilt = RepoCommit.fromRecords(
        records.map((r) => ({ ...r, cid: parseCid(r.cid) })),
      )
      expect(rebuilt.matches(commit)).toBe(true)
    })

    it('serves a verifiable STAR archive', async () => {
      const space = await sc.createSpace(alice, { members: [bob, carol] })
      await sc.write(bob, space, { rkey: 'one', text: 'record' })
      await sc.write(bob, space, {
        collection: TEST_COLLECTION_ALT,
        rkey: 'two',
        text: 'note',
      })

      const cred = await sc.credentialFor(carol, space)
      const { commit, records } = await getRepo(cred, bob, space)

      expect(commit.rev).toBe((await sc.latestCommit(bob, space))!.rev)
      expect(records).toMatchObject([
        {
          collection: TEST_COLLECTION_ALT,
          rkey: 'two',
          record: { text: 'note' },
        },
        {
          collection: TEST_COLLECTION,
          rkey: 'one',
          record: { text: 'record' },
        },
      ])
    })

    it('streams a STAR archive past one page of records', async () => {
      const space = await sc.createSpace(alice, { members: [dan, carol] })
      const rkeys = Array.from({ length: 501 }, (_, i) => `r${i}`)
      for (let i = 0; i < rkeys.length; i += 200) {
        await dan.client.call(
          com.atproto.space.applyWrites,
          {
            space,
            repo: dan.did,
            writes: rkeys.slice(i, i + 200).map(createOp),
          },
          { headers: dan.headers },
        )
      }

      const cred = await sc.credentialFor(carol, space)
      const { records } = await getRepo(cred, dan, space)
      expect(records).toHaveLength(rkeys.length)
    })

    it('recovers a cleared repo, whose oplog is empty, from getRepo', async () => {
      const space = await sc.createSpace(alice, { members: [bob, carol] })
      await sc.write(bob, space, { rkey: 'one' })
      await sc.write(bob, space, { rkey: 'two' })
      const cred = await sc.credentialFor(carol, space)
      const client = cred.clientFor(bob.pds)
      const params = { space, repo: bob.did }
      const synced = await client.call(com.atproto.space.listRepoOps, params)
      const local = replay(synced.ops)
      expect(local.matches(synced.commit)).toBe(true)

      await sc.clear(bob, space)

      const incremental = await client.call(com.atproto.space.listRepoOps, {
        ...params,
        since: synced.commit.rev,
      })
      cred.verifyCommit(incremental.commit, params)
      expect(incremental.ops).toEqual([])
      expect(local.matches(incremental.commit)).toBe(false)

      const recovered = await getRepo(cred, bob, space)
      expect(recovered.commit.rev).toBe(incremental.commit.rev)
      expect(recovered.records).toEqual([])
    })

    it('reports RepoNotFound for an unwritten repo', async () => {
      const space = await sc.createSpace(alice, { members: [carol] })
      const cred = await sc.credentialFor(carol, space)
      const client = cred.clientFor(alice.pds)
      const params = { space, repo: alice.did }

      await expect(
        client.call(com.atproto.space.getLatestCommit, params),
      ).rejects.toMatchObject({ error: 'RepoNotFound' })
      await expect(
        client.call(com.atproto.space.listRepoOps, params),
      ).rejects.toMatchObject({ error: 'RepoNotFound' })
      await expect(
        client.xrpc(com.atproto.space.getRepo, { params }),
      ).rejects.toMatchObject({ error: 'RepoNotFound' })
    })
  })

  describe('MACs', () => {
    it("publishes each account's KEM key in its DID document and recommended credentials", async () => {
      const { verificationMethods } = await bob.client.call(
        com.atproto.identity.getRecommendedDidCredentials,
        {},
        { headers: bob.headers },
      )
      expect(verificationMethods).toMatchObject({
        atproto_kem: await kemKeyOf(bob),
      })
    })

    it('macs a record served to a syncer', async () => {
      const space = await sc.createSpace(alice, { members: [bob, carol] })
      await sc.write(bob, space, { rkey: 'maced' })

      const cred = await sc.credentialFor(carol, space)
      const res = await cred
        .clientFor(bob.pds)
        .call(com.atproto.space.getRecord, {
          space,
          repo: bob.did,
          collection: TEST_COLLECTION,
          rkey: 'maced',
        })

      expect(cred.lastMac?.profile).toBe(RECORD_MAC_PROFILE)
      await verifyRecord(res, {
        uri: `${space}/${bob.did}/${TEST_COLLECTION}/maced` as SpaceAtUriString,
        ...cred.lastMacParams(),
      })
    })

    it('refuses a space credential that requests no MAC, or an unusable one', async () => {
      const space = await sc.createSpace(alice, { members: [bob] })
      await sc.write(bob, space)
      const cred = await sc.credentialFor(bob, space)
      const getLatestCommit = async (acceptSignature?: string) => {
        const headers = await cred.signedHeaders(bob.did)
        if (acceptSignature) headers['accept-signature'] = acceptSignature
        return bob.client.call(
          com.atproto.space.getLatestCommit,
          { space, repo: bob.did },
          { headers },
        )
      }

      await expect(getLatestCommit()).rejects.toMatchObject({
        error: 'InvalidSpaceMac',
        message: `A MAC must be requested with tag "${COMMIT_MAC_PROFILE}"`,
      })
      await expect(
        getLatestCommit(formatMacRequest(COMMIT_MAC_PROFILE, 'did:key:nope')),
      ).rejects.toMatchObject({
        error: 'InvalidSpaceMac',
        message: 'invalid KEM key',
      })
    })

    it('macs an account its own data only when asked', async () => {
      const space = await sc.createSpace(alice, { members: [bob] })
      await sc.write(bob, space)
      const params = { space, repo: bob.did }

      const unasked = await bob.client.xrpc(com.atproto.space.getLatestCommit, {
        params,
        headers: bob.headers,
      })
      expect(unasked.headers.get('signature')).toBeNull()
      expect(unasked.headers.get('vary')).toMatch(/accept-signature/i)

      const encapsulation = await encapsulate(await kemKeyOf(bob))
      const asked = await bob.client.xrpc(com.atproto.space.getLatestCommit, {
        params,
        headers: {
          ...bob.headers,
          'accept-signature': formatMacRequest(
            COMMIT_MAC_PROFILE,
            encapsulation.keyShare,
          ),
        },
      })
      // So that a browser app can read the MAC.
      const exposed = asked.headers.get('access-control-expose-headers')
      expect(exposed).toMatch(/atproto-space-commit/i)
      expect(exposed).toMatch(/signature-input/i)
      verifyCommit(asked.body.commit, {
        ...params,
        ...encapsulation,
        headers: asked.headers,
      })
    })
  })

  describe('writer set', () => {
    it('records a co-located writer without resolving the space host', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      {
        using resolve = jest
          .spyOn(network.pds.ctx.idResolver.did, 'resolve')
          .mockRejectedValue(new Error('unreachable'))
        await sc.write(dan, space)
        expect(resolve).not.toHaveBeenCalled()
      }
      expect(await sc.writers(space, alice)).toEqual([dan.did])
    })

    it('lists a remote writer at its latest commit, and not a member who has not written', async () => {
      const space = await sc.createSpace(alice, { members: [bob, carol] })
      await sc.write(bob, space)
      const commit = (await sc.latestCommit(bob, space))!

      const cred = await sc.credentialFor(carol, space)
      const { repos } = await listWriters(cred, space)
      expect(repos).toEqual([
        repoWrite.$build({
          repo: bob.did,
          repoRev: commit.rev,
          data: commit.data,
          spaceRev: expect.any(String),
        }),
      ])
    })

    it('records a writer into an app-gated space, whose PDS presents no attestation', async () => {
      await using app = await MockClientApp.create()
      using _ = app.installOn(alice.pds)
      const space = await sc.createSpace(alice, {
        members: [bob],
        policy: com.atproto.memberspace.policy.$build({
          allowedApps: [app.clientId],
        }),
      })

      await sc.write(bob, space)

      const cred = await sc.credentialFor(alice, space, {
        clientAttestation: await app.attest(spaceHostAud(alice.did)),
      })
      const { repos } = await listWriters(cred, space)
      expect(repos.map((r) => r.repo)).toEqual([bob.did])
    })

    it('keeps a cleared repo in the writer set, at the empty digest', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.write(dan, space)

      await sc.clear(dan, space)

      const commit = (await sc.latestCommit(dan, space))!
      const cred = await sc.credentialFor(alice, space)
      const { repos } = await listWriters(cred, space)
      expect(repos).toEqual([
        repoWrite.$build({
          repo: dan.did,
          repoRev: commit.rev,
          data: new LtHash().digest(),
          spaceRev: expect.any(String),
        }),
      ])
    })

    it('lists a removed writer at a new space revision, and restores it on its next write', async () => {
      const space = await sc.createSpace(alice, { members: [bob] })
      await sc.write(bob, space)
      const cred = await sc.credentialFor(alice, space)
      const { cursor } = await listWriters(cred, space)

      await sc.removeWriter(alice, space, bob)

      const caughtUp = await listWriters(cred, space, { cursor })
      expect(caughtUp.repos).toEqual([
        repoRemoved.$build({ repo: bob.did, spaceRev: caughtUp.cursor! }),
      ])

      await sc.write(bob, space)
      expect(await sc.writers(space, alice)).toEqual([bob.did])
    })

    it('ignores removeWriter for a repo outside the writer set', async () => {
      const space = await sc.createSpace(alice, { members: [bob, dan] })
      await sc.write(dan, space)
      await sc.removeWriter(alice, space, dan)
      const cred = await sc.credentialFor(alice, space)
      const before = await listWriters(cred, space)

      // One that never wrote, and one already removed.
      await sc.removeWriter(alice, space, bob)
      await sc.removeWriter(alice, space, dan)

      expect(await listWriters(cred, space)).toEqual(before)
    })

    it('refuses removeWriter from anyone but the authority', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.write(dan, space)

      await expect(sc.removeWriter(dan, space, dan)).rejects.toMatchObject({
        error: 'NotAuthorized',
      })
      expect(await sc.writers(space, alice)).toEqual([dan.did])
    })
  })

  describe('listWriters', () => {
    it('pages by space revision, moving a rewritten repo to the end', async () => {
      const space = await sc.createSpace(alice, { members: [bob, dan] })
      const cred = await sc.credentialFor(alice, space)
      const page = async (cursor?: string, limit?: number) => {
        const res = await listWriters(cred, space, { cursor, limit })
        return { repos: res.repos.map((r) => r.repo), cursor: res.cursor }
      }
      await sc.write(bob, space)
      const { cursor } = await page()
      await sc.write(dan, space)
      await sc.write(bob, space)

      const first = await page(cursor, 1)
      expect(first.repos).toEqual([dan.did])
      // Dan writes again while the caller is paging.
      await sc.write(dan, space)
      const second = await page(first.cursor, 1)
      expect(second.repos).toEqual([bob.did])
      const third = await page(second.cursor, 1)
      expect(third.repos).toEqual([dan.did])
      await expect(page(third.cursor)).resolves.toEqual({
        repos: [],
        cursor: undefined,
      })
    })

    it("returns the space's current revision on each authorization", async () => {
      const space = await sc.createSpace(alice, { members: [dan, carol] })
      const cred = await sc.credentialFor(alice, space)
      const spaceRev = async () =>
        (await sc.credentialFor(carol, space)).spaceRev
      expect(await spaceRev()).toBeUndefined()

      await sc.write(dan, space)
      const written = await listWriters(cred, space)
      expect(await spaceRev()).toBe(written.cursor)

      await sc.removeWriter(alice, space, dan)
      const removed = await listWriters(cred, space)
      expect(removed.cursor).not.toBe(written.cursor)
      expect(await spaceRev()).toBe(removed.cursor)
    })
  })

  describe('forwarding', () => {
    it('chains forwarded writes across local and remote writers', async () => {
      await using syncer = await MockService.create(network, {
        serviceId: 'atproto_space_syncer',
      })
      const space = await sc.createSpace(alice, { members: [bob, dan, carol] })
      const cred = await sc.credentialFor(carol, space, {
        notify: syncer.notifyRegistration(),
      })

      await sc.write(alice, space)
      await Promise.all([sc.write(bob, space), sc.write(dan, space)])
      await alice.pds.ctx.backgroundQueue.processAll()

      const writes = syncer
        .spaceUpdates()
        .filter((update) => repoWrite.$isTypeOf(update))
        .sort((a, b) => (a.spaceRev < b.spaceRev ? -1 : 1))
      expect(writes.map((w) => w.prevSpaceRev)).toEqual([
        undefined,
        writes[0].spaceRev,
        writes[1].spaceRev,
      ])
      const { repos } = await listWriters(cred, space)
      expect(repos.map((r) => r.spaceRev)).toEqual(
        writes.map((w) => w.spaceRev),
      )
    })

    it('forwards a removal in the same sequence', async () => {
      await using syncer = await MockService.create(network, {
        serviceId: 'atproto_space_syncer',
      })
      const space = await sc.createSpace(alice, { members: [dan, carol] })
      const cred = await sc.credentialFor(carol, space, {
        notify: syncer.notifyRegistration(),
      })

      await sc.write(dan, space)
      await sc.removeWriter(alice, space, dan)
      await alice.pds.ctx.backgroundQueue.processAll()

      const updates = syncer.spaceUpdates()
      const write = updates.find((update) => repoWrite.$isTypeOf(update))
      const { cursor } = await listWriters(cred, space)
      expect(updates).toHaveLength(2)
      expect(updates).toContainEqual(
        repoRemoved.$build({
          repo: dan.did,
          spaceRev: cursor!,
          prevSpaceRev: write!.spaceRev,
        }),
      )
    })
  })

  describe('notifyRepoUpdate', () => {
    const notify = async (
      signer: Actor,
      update: {
        space: SpaceRefString
        repo?: DidString
        repoRev?: string
        data?: Uint8Array
      },
      opts: { aud?: string } = {},
    ) => {
      const { headers } = await createServiceAuthHeaders({
        iss: signer.did,
        aud: opts.aud ?? spaceHostAud(alice.did),
        lxm: com.atproto.space.notifyRepoUpdate.$lxm,
        keypair: await signer.pds.ctx.actorStore.keypair(signer.did),
      })
      return alice.client.call(
        com.atproto.space.notifyRepoUpdate,
        {
          repo: signer.did,
          repoRev: TID.nextStr(),
          data: new LtHash().digest(),
          ...update,
        },
        { headers },
      )
    }

    it('ignores duplicate and older revisions without forwarding them', async () => {
      await using syncer = await MockService.create(network, {
        serviceId: 'atproto_space_syncer',
      })
      const space = await sc.createSpace(alice, { members: [bob] })
      const cred = await sc.credentialFor(alice, space, {
        notify: syncer.notifyRegistration(),
      })
      await sc.write(bob, space)
      const older = (await sc.latestCommit(bob, space))!.rev
      await sc.write(bob, space)
      const current = (await sc.latestCommit(bob, space))!.rev
      await alice.pds.ctx.backgroundQueue.processAll()
      const before = await listWriters(cred, space)
      const forwarded = syncer.spaceUpdates().length

      for (const repoRev of [older, current]) {
        await notify(bob, { space, repoRev, data: new Uint8Array(32) })
      }
      await alice.pds.ctx.backgroundQueue.processAll()

      expect(await listWriters(cred, space)).toEqual(before)
      expect(syncer.spaceUpdates()).toHaveLength(forwarded)
    })

    it('keeps the newest repo revision when notifications race', async () => {
      const space = await sc.createSpace(alice, { members: [bob] })
      const older = TID.nextStr()
      const newer = TID.nextStr(older)
      const data = new LtHash().digest()

      await Promise.all([
        notify(bob, { space, repoRev: newer, data }),
        notify(bob, { space, repoRev: older, data: new Uint8Array(32) }),
      ])

      const cred = await sc.credentialFor(alice, space)
      const { repos } = await listWriters(cred, space)
      expect(repos).toEqual([
        repoWrite.$build({
          repo: bob.did,
          repoRev: newer,
          data,
          spaceRev: expect.any(String),
        }),
      ])
    })

    it('rejects future revisions while allowing a small clock skew', async () => {
      const space = await sc.createSpace(alice, { members: [bob] })
      const revIn = (ms: number) =>
        TID.fromTime((Date.now() + ms) * 1000, 0).toString()

      await expect(
        notify(bob, { space, repoRev: revIn(10 * MINUTE) }),
      ).rejects.toMatchObject({ error: 'FutureRev' })
      expect(await sc.writers(space, alice)).toEqual([])

      await notify(bob, { space, repoRev: revIn(MINUTE) })
      expect(await sc.writers(space, alice)).toEqual([bob.did])
    })

    it('rejects one that spoofs the writer', async () => {
      const space = await sc.createSpace(alice, { members: [bob, carol] })
      await expect(
        notify(bob, { space, repo: carol.did }),
      ).rejects.toMatchObject({
        error: 'Forbidden',
        message: 'Notification iss does not match the repo',
      })
    })

    it('rejects one addressed to another authority', async () => {
      const space = await sc.createSpace(alice, { members: [bob] })
      await expect(
        notify(bob, { space }, { aud: carol.did }),
      ).rejects.toMatchObject({
        error: 'Forbidden',
        message: 'Notification aud does not match the space authority',
      })
    })

    it.each([
      { who: 'a non-member', publicWrite: false, member: false },
      {
        who: 'a member without write access',
        publicWrite: false,
        member: true,
      },
      {
        who: 'a member without write access, even when writes are public',
        publicWrite: true,
        member: true,
      },
    ])('refuses $who', async ({ publicWrite, member }) => {
      const space = await sc.createSpace(alice, {
        policy: com.atproto.memberspace.policy.$build({ publicWrite }),
      })
      if (member) {
        await sc.putMember(alice, space, bob, { read: true, write: false })
      }

      await expect(notify(bob, { space })).rejects.toMatchObject({
        error: 'Forbidden',
        message: 'Repo is not authorized to write to the space',
      })
      expect(await sc.writers(space, alice)).toEqual([])
    })

    it('admits a non-member when writes are public', async () => {
      const space = await sc.createSpace(alice, {
        policy: com.atproto.memberspace.policy.$build({ publicWrite: true }),
      })

      await notify(bob, { space })

      expect(await sc.writers(space, alice)).toEqual([bob.did])
    })

    it('refuses one for a deleted space', async () => {
      const skey = TID.nextStr()
      const space = await sc.createSpace(alice, { skey, members: [bob] })
      await alice.client.call(
        com.atproto.space.deleteSpace,
        { space },
        { headers: alice.headers },
      )

      await expect(notify(bob, { space })).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
      // The space's URI may be reused, and must not inherit the refused writer.
      await sc.createSpace(alice, { skey })
      expect(await sc.writers(space, alice)).toEqual([])
    })
  })
})
