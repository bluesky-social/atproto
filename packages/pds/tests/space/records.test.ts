import { TestNetworkNoAppView } from '@atproto/dev-env'
import { getBlobCidString, parseCid } from '@atproto/lex-data'
import { NsidString } from '@atproto/syntax'
import { com } from '../../src/lexicons/index.js'
import {
  Actor,
  SpaceClient,
  TEST_COLLECTION,
  TEST_COLLECTION_ALT,
  record,
} from '../_space.js'

/**
 * Reading and writing records in a space.
 *
 * A space's records live in each member's own repo, on their own PDS — the space
 * is a namespace over them, not a place they're stored. So a write is always to
 * the caller's own repo, and reading someone else's takes a credential from the
 * authority (see `auth.test.ts`).
 */
describe('space records', () => {
  let network: TestNetworkNoAppView
  let sc: SpaceClient
  let alice: Actor // authority / owner, on pds1
  let dan: Actor // member co-located with the authority on pds1
  let bob: Actor // member on pds2
  let carol: Actor // on pds3; a member only where a test says so

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'space_records',
      extraPdses: 2,
    })
    sc = new SpaceClient(network)
    alice = await sc.createActor('alice', network.pds)
    dan = await sc.createActor('dan', network.pds)
    bob = await sc.createActor('bob', network.extraPdses[0], 'test2')
    carol = await sc.createActor('carol', network.extraPdses[1], 'test3')
  })

  afterAll(async () => {
    await network?.close()
  })

  describe('writes', () => {
    it('writes a record as a co-located member', async () => {
      // Dan shares a PDS with the owner — the pure single-PDS write path.
      const space = await sc.createSpace(alice, { members: [dan] })
      const before = await sc.repoState(dan, space)

      const created = await sc.write(dan, space, { text: 'hello from dan' })
      expect(created.uri).toContain(dan.did)

      const rkey = created.uri.split('/').pop()!
      const got = await dan.client.call(
        com.atproto.space.getRecord,
        { space, repo: dan.did, collection: TEST_COLLECTION, rkey },
        { headers: dan.headers },
      )
      expect(got.value).toMatchObject({ text: 'hello from dan' })

      // The repo advances on both axes: a new rev, and a set hash covering the
      // record just added.
      const after = await sc.repoState(dan, space)
      expect(after!.rev).not.toEqual(before?.rev ?? null)
      expect(after!.setHash).not.toEqual(before?.setHash ?? null)
      await sc.expectSetHashMatchesStore(dan, space)
    })

    it('writes a record from a remote PDS', async () => {
      // Bob is on pds2. His PDS fires a best-effort notifyWrite at the authority,
      // but the authoritative record of the write is the oplog on his own PDS.
      const space = await sc.createSpace(alice, { members: [bob] })

      const created = await sc.write(bob, space, { text: 'hello from bob' })
      expect(created.uri).toContain(bob.did)

      const ops = await bob.client.call(
        com.atproto.space.listRepoOps,
        { space, repo: bob.did },
        { headers: bob.headers },
      )
      // The wire op carries no `action`: it's derivable, and a create is exactly
      // an op that names a cid and no prev.
      const last = ops.ops.at(-1)!
      expect(last).toMatchObject({ cid: created.cid, prev: null })

      // Bob's PDS materialized its local space row lazily, on this first write.
      // The member list is the authority's concern and is never pushed to a
      // member's PDS, so `listSpaces` there reflects spaces written to, not
      // spaces joined.
      const listed = await bob.client.call(
        com.atproto.space.listSpaces,
        {},
        { headers: bob.headers },
      )
      expect(listed.spaces.map((s) => s.uri)).toContain(space)
    })

    it('refuses a write to another account repo', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await expect(
        dan.client.call(
          com.atproto.space.createRecord,
          {
            space,
            repo: alice.did,
            collection: TEST_COLLECTION,
            record: record(TEST_COLLECTION),
          },
          { headers: dan.headers },
        ),
      ).rejects.toMatchObject({ error: 'Forbidden' })
    })

    it('deletes a record', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      const created = await sc.write(dan, space, { text: 'to be deleted' })
      const rkey = created.uri.split('/').pop()!

      await sc.del(dan, space, { rkey })

      const ops = await dan.client.call(
        com.atproto.space.listRepoOps,
        { space, repo: dan.did },
        { headers: dan.headers },
      )
      const deleted = ops.ops.find((op) => op.cid === null)
      expect(deleted).toMatchObject({ rkey, cid: null })
      // The delete names what it replaced, so a syncer can subtract it.
      expect(deleted!.prev).toBe(created.cid)
      await sc.expectSetHashMatchesStore(dan, space)
    })

    it('deleteRecord is idempotent', async () => {
      const space = await sc.createSpace(alice)
      // Never existed.
      await sc.del(alice, space, { rkey: 'gone' })

      await sc.write(alice, space, { rkey: 'gone', text: 'here' })
      await sc.del(alice, space, { rkey: 'gone' })
      // Already deleted.
      await sc.del(alice, space, { rkey: 'gone' })
    })
  })

  describe('putRecord', () => {
    it('creates a record that does not yet exist', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      const put = await sc.put(dan, space, { rkey: 'put-new', text: 'first' })
      expect(put.uri).toBe(`${space}/${dan.did}/${TEST_COLLECTION}/put-new`)

      const got = await dan.client.call(
        com.atproto.space.getRecord,
        { space, repo: dan.did, collection: TEST_COLLECTION, rkey: 'put-new' },
        { headers: dan.headers },
      )
      expect(got.value).toMatchObject({ text: 'first' })
    })

    it('overwrites an existing record, and the oplog names what it replaced', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      const created = await sc.put(dan, space, {
        rkey: 'put-over',
        text: 'first',
      })
      const updated = await sc.put(dan, space, {
        rkey: 'put-over',
        text: 'second',
      })
      expect(updated.cid).not.toBe(created.cid)

      const got = await dan.client.call(
        com.atproto.space.getRecord,
        { space, repo: dan.did, collection: TEST_COLLECTION, rkey: 'put-over' },
        { headers: dan.headers },
      )
      expect(got.value).toMatchObject({ text: 'second' })

      // An update is a remove-then-add against the set hash, so the op has to
      // carry the superseded cid for a syncer to stay convergent.
      const ops = await dan.client.call(
        com.atproto.space.listRepoOps,
        { space, repo: dan.did },
        { headers: dan.headers },
      )
      const last = ops.ops.at(-1)!
      expect(last).toMatchObject({ cid: updated.cid, prev: created.cid })
      await sc.expectSetHashMatchesStore(dan, space)

      // One record, not two.
      const listed = await dan.client.call(
        com.atproto.space.listRecords,
        { space, repo: dan.did, collection: TEST_COLLECTION },
        { headers: dan.headers },
      )
      expect(listed.records).toHaveLength(1)
    })
  })

  describe('applyWrites', () => {
    const create = (rkey: string, text: string) =>
      ({
        $type: 'com.atproto.space.applyWrites#create' as const,
        collection: TEST_COLLECTION,
        rkey,
        value: record(TEST_COLLECTION, text),
      }) as const

    it('applies a batch as one rev', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })

      await dan.client.call(
        com.atproto.space.applyWrites,
        {
          space,
          repo: dan.did,
          writes: [0, 1, 2].map((i) => create(`batch-${i}`, `batch ${i}`)),
        },
        { headers: dan.headers },
      )

      const ops = await dan.client.call(
        com.atproto.space.listRepoOps,
        { space, repo: dan.did },
        { headers: dan.headers },
      )
      // One batch is one commit: a single rev shared by every op in it.
      expect(new Set(ops.ops.map((o) => o.rev)).size).toBe(1)
      expect(ops.ops.map((o) => o.rkey)).toEqual([
        'batch-0',
        'batch-1',
        'batch-2',
      ])
    })

    it('rejects a duplicate create within one batch', async () => {
      // Resolving each write against storage alone would let both through,
      // adding to the set hash twice while the upsert leaves one row.
      const space = await sc.createSpace(alice, { members: [dan] })

      await expect(
        dan.client.call(
          com.atproto.space.applyWrites,
          {
            space,
            repo: dan.did,
            writes: [create('dupe', 'one'), create('dupe', 'two')],
          },
          { headers: dan.headers },
        ),
      ).rejects.toMatchObject({ error: 'RecordAlreadyExists' })

      await sc.expectSetHashMatchesStore(dan, space)
    })

    it('applies dependent writes within one batch', async () => {
      // Each write must see the effect of the one before it.
      const space = await sc.createSpace(alice, { members: [dan] })

      await dan.client.call(
        com.atproto.space.applyWrites,
        {
          space,
          repo: dan.did,
          writes: [
            create('dependent', 'first'),
            {
              $type: 'com.atproto.space.applyWrites#update' as const,
              collection: TEST_COLLECTION,
              rkey: 'dependent',
              value: record(TEST_COLLECTION, 'second'),
            },
            create('survivor', 'survivor'),
            {
              $type: 'com.atproto.space.applyWrites#delete' as const,
              collection: TEST_COLLECTION,
              rkey: 'dependent',
            },
          ],
        },
        { headers: dan.headers },
      )

      const listed = await dan.client.call(
        com.atproto.space.listRecords,
        { space, repo: dan.did },
        { headers: dan.headers },
      )
      expect(listed.records.map((r) => r.rkey)).toEqual(['survivor'])
      await sc.expectSetHashMatchesStore(dan, space)
    })

    it('treats an empty batch as a no-op', async () => {
      // A rev with no op behind it reads to a syncer as state it never received,
      // and would let a batch that writes nothing materialize a repo.
      const space = await sc.createSpace(alice, { members: [dan] })

      const res = await dan.client.call(
        com.atproto.space.applyWrites,
        { space, repo: dan.did, writes: [] },
        { headers: dan.headers },
      )
      expect(res.results).toEqual([])

      // Dan's repo state is materialized on his first write, so writing nothing
      // leaves no repo state at all.
      expect(await sc.repoState(dan, space)).toBeNull()

      // And with no commit to sign, the repo still reads as unwritten.
      await expect(
        dan.client.call(
          com.atproto.space.getLatestCommit,
          { space, repo: dan.did },
          { headers: dan.headers },
        ),
      ).rejects.toMatchObject({ error: 'RepoNotFound' })
    })

    it('reports each result against the write it came from', async () => {
      // Results are built from the prepared writes, so a delete in the middle of
      // a batch can't shift the uris or validation statuses of its neighbours.
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.write(dan, space, { rkey: 'doomed', text: 'doomed' })

      const res = await dan.client.call(
        com.atproto.space.applyWrites,
        {
          space,
          repo: dan.did,
          writes: [
            create('first', 'first'),
            {
              $type: 'com.atproto.space.applyWrites#delete' as const,
              collection: TEST_COLLECTION,
              rkey: 'doomed',
            },
            create('last', 'last'),
          ],
        },
        { headers: dan.headers },
      )

      const [first, deleted, last] = res.results ?? []
      expect(deleted.$type).toBe('com.atproto.space.applyWrites#deleteResult')
      expect(first['uri']).toBe(`${space}/${dan.did}/${TEST_COLLECTION}/first`)
      expect(last['uri']).toBe(`${space}/${dan.did}/${TEST_COLLECTION}/last`)
      // A third-party collection, so both creates report 'unknown' — on
      // themselves, not shifted onto the delete's slot.
      expect(first['validationStatus']).toBe('unknown')
      expect(last['validationStatus']).toBe('unknown')
    })

    it('refuses a batch over the write limit', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await expect(
        dan.client.call(
          com.atproto.space.applyWrites,
          {
            space,
            repo: dan.did,
            writes: Array.from({ length: 201 }, (_, i) =>
              create(`over-${i}`, `over ${i}`),
            ),
          },
          { headers: dan.headers },
        ),
      ).rejects.toThrow(/Too many writes/)
    })

    it('refuses an unrecognized write type at the schema', async () => {
      // `writes` is a closed union, so an unknown member never reaches the
      // handler's own `Action not supported` fallback — schema validation names
      // the three it will accept and points at the offending write.
      const space = await sc.createSpace(alice, { members: [dan] })
      await expect(
        dan.client.call(
          com.atproto.space.applyWrites,
          {
            space,
            repo: dan.did,
            writes: [{ $type: 'com.example.somethingElse' } as never],
          },
          { headers: dan.headers },
        ),
      ).rejects.toThrow(/Expected one of.*applyWrites#create.*\$\.writes\[0\]/s)
    })
  })

  describe('validation', () => {
    it('rejects a record whose $type disagrees with its collection', async () => {
      const space = await sc.createSpace(alice)
      await expect(
        alice.client.call(
          com.atproto.space.createRecord,
          {
            space,
            repo: alice.did,
            collection: TEST_COLLECTION,
            record: record(TEST_COLLECTION_ALT, 'mismatched'),
          },
          { headers: alice.headers },
        ),
      ).rejects.toThrow()
    })

    it('reports unknown for a collection with no resolvable schema', async () => {
      // Same as a public write of a third-party collection: the PDS validates
      // against a hardcoded schema map, so anything outside it is unvalidatable
      // rather than invalid.
      const space = await sc.createSpace(alice)
      const created = await sc.write(alice, space, { text: 'unvalidatable' })
      expect(created.validationStatus).toBe('unknown')
    })

    it('refuses an unvalidatable record when validation is demanded', async () => {
      const space = await sc.createSpace(alice)
      await expect(
        sc.write(alice, space, { text: 'strict', validate: true }),
      ).rejects.toThrow()
    })
  })

  describe('listRecords', () => {
    it('paginates across collections', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.write(dan, space, {
        collection: TEST_COLLECTION,
        rkey: 'a',
        text: 'post',
      })
      await sc.write(dan, space, {
        collection: TEST_COLLECTION_ALT,
        rkey: 'b',
        text: 'note',
      })

      // Two pages of one record each; the cursor has to span collections.
      const first = await dan.client.call(
        com.atproto.space.listRecords,
        { space, repo: dan.did, limit: 1 },
        { headers: dan.headers },
      )
      expect(first.records).toHaveLength(1)
      expect(first.cursor).toBeDefined()

      const second = await dan.client.call(
        com.atproto.space.listRecords,
        { space, repo: dan.did, limit: 1, cursor: first.cursor },
        { headers: dan.headers },
      )
      expect(second.records).toHaveLength(1)
      expect(second.records[0].collection).not.toBe(first.records[0].collection)

      const third = await dan.client.call(
        com.atproto.space.listRecords,
        { space, repo: dan.did, limit: 1, cursor: second.cursor },
        { headers: dan.headers },
      )
      expect(third.records).toEqual([])
    })

    it('filters to one collection', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.write(dan, space, { collection: TEST_COLLECTION, rkey: 'a' })
      await sc.write(dan, space, { collection: TEST_COLLECTION_ALT, rkey: 'b' })

      const listed = await dan.client.call(
        com.atproto.space.listRecords,
        { space, repo: dan.did, collection: TEST_COLLECTION_ALT },
        { headers: dan.headers },
      )
      expect(listed.records.map((r) => r.collection)).toEqual([
        TEST_COLLECTION_ALT,
      ])
    })

    it('reverses the listing order', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      for (const rkey of ['aaa', 'bbb', 'ccc']) {
        await sc.write(dan, space, { rkey })
      }

      const forward = await dan.client.call(
        com.atproto.space.listRecords,
        { space, repo: dan.did, collection: TEST_COLLECTION },
        { headers: dan.headers },
      )
      const reversed = await dan.client.call(
        com.atproto.space.listRecords,
        { space, repo: dan.did, collection: TEST_COLLECTION, reverse: true },
        { headers: dan.headers },
      )
      expect(reversed.records.map((r) => r.rkey)).toEqual(
        forward.records.map((r) => r.rkey).reverse(),
      )
    })

    it('scopes a listing to one space', async () => {
      const space = await sc.createSpace(alice, { skey: 'scope-a' })
      const other = await sc.createSpace(alice, { skey: 'scope-b' })
      await sc.write(alice, space, { rkey: 'here' })

      const listed = await alice.client.call(
        com.atproto.space.listRecords,
        { space: other, repo: alice.did },
        { headers: alice.headers },
      )
      expect(listed.records).toEqual([])
    })
  })

  describe('getRecord', () => {
    // @NOTE unlike `com.atproto.repo.getRecord`, the space lexicon declares no
    // `cid` param, so there is no read-at-a-specific-version here. The storage
    // layer supports it (`SpaceReader.getRecord` takes an optional cid) but
    // nothing calls it — worth either exposing or dropping.
    it('returns the record and its current cid', async () => {
      const space = await sc.createSpace(alice)
      const created = await sc.write(alice, space, { rkey: 'by-cid' })

      const got = await alice.client.call(
        com.atproto.space.getRecord,
        {
          space,
          repo: alice.did,
          collection: TEST_COLLECTION,
          rkey: 'by-cid',
        },
        { headers: alice.headers },
      )
      expect(got.cid).toBe(created.cid)
      expect(got.uri).toBe(`${space}/${alice.did}/${TEST_COLLECTION}/by-cid`)
    })

    it('reports RecordNotFound for a record that never existed', async () => {
      const space = await sc.createSpace(alice)
      await sc.write(alice, space, { rkey: 'present' })
      await expect(
        alice.client.call(
          com.atproto.space.getRecord,
          {
            space,
            repo: alice.did,
            collection: TEST_COLLECTION,
            rkey: 'absent',
          },
          { headers: alice.headers },
        ),
      ).rejects.toMatchObject({ error: 'RecordNotFound' })
    })
  })

  describe('blobs', () => {
    const upload = async (actor: Actor, bytes: Uint8Array) => {
      const { body } = await actor.client.uploadBlob(bytes, {
        headers: actor.headers,
        encoding: 'image/png',
      })
      return body.blob
    }

    it('tracks a blob on a space record and serves it to a member', async () => {
      const space = await sc.createSpace(alice, { members: [carol] })

      // Spaces have no upload method of their own: a blob is uploaded normally
      // and becomes permanent when a record references it.
      const bytes = new Uint8Array([1, 2, 3, 4, 5])
      const blob = await upload(alice, bytes)
      const blobCid = getBlobCidString(blob)

      // Untethered until a record references it.
      await expect(
        network.pds.ctx.blobstore(alice.did).getBytes(parseCid(blobCid)),
      ).rejects.toThrow()

      await sc.write(alice, space, {
        rkey: 'with-blob',
        record: { $type: TEST_COLLECTION, text: 'has a blob', image: blob },
      })

      const stored = await network.pds.ctx
        .blobstore(alice.did)
        .getBytes(parseCid(blobCid))
      expect(new Uint8Array(stored)).toEqual(bytes)

      const cred = await sc.credentialFor(carol, space)
      const listed = await cred
        .clientFor(alice.pds)
        .call(com.atproto.space.listBlobs, { space, repo: alice.did })
      expect(listed.cids).toEqual([blobCid])

      const res = await cred.fetch(
        `${network.pds.url}/xrpc/com.atproto.space.getBlob?space=${encodeURIComponent(space)}&repo=${alice.did}&cid=${blobCid}`,
      )
      expect(res.status).toBe(200)
      expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes)
    })

    it('keeps a blob shared with a public record', async () => {
      const space = await sc.createSpace(alice)
      const blob = await upload(alice, new Uint8Array([7, 7, 7]))
      const blobCid = getBlobCidString(blob)

      await alice.client.call(
        com.atproto.repo.createRecord,
        {
          repo: alice.did,
          collection: 'app.bsky.actor.profile' as NsidString,
          rkey: 'self',
          record: { $type: 'app.bsky.actor.profile', avatar: blob },
        },
        { headers: alice.headers },
      )
      await sc.write(alice, space, {
        rkey: 'shared',
        record: { $type: TEST_COLLECTION, text: 'shared', image: blob },
      })

      // Deleting the public record must not strand the space record's bytes.
      await alice.client.call(
        com.atproto.repo.deleteRecord,
        {
          repo: alice.did,
          collection: 'app.bsky.actor.profile' as NsidString,
          rkey: 'self',
        },
        { headers: alice.headers },
      )
      await network.processAll()
      expect(await sc.blobExists(alice, blobCid)).toBe(true)

      // And the reverse: dropping the space record leaves nothing behind.
      await sc.del(alice, space, { rkey: 'shared' })
      await network.processAll()
      expect(await sc.blobExists(alice, blobCid)).toBe(false)
    })

    it('filters listBlobs by revision', async () => {
      const space = await sc.createSpace(alice, { members: [carol] })

      const first = await upload(alice, new Uint8Array([1]))
      await sc.write(alice, space, {
        rkey: 'first',
        record: { $type: TEST_COLLECTION, text: 'first', image: first },
      })
      const midRev = (await sc.repoState(alice, space))?.rev ?? undefined

      const second = await upload(alice, new Uint8Array([2]))
      await sc.write(alice, space, {
        rkey: 'second',
        record: { $type: TEST_COLLECTION, text: 'second', image: second },
      })

      const cred = await sc.credentialFor(carol, space)
      const asSyncer = cred.clientFor(alice.pds)
      const all = await asSyncer.call(com.atproto.space.listBlobs, {
        space,
        repo: alice.did,
      })
      expect(all.cids.sort()).toEqual(
        [getBlobCidString(first), getBlobCidString(second)].sort(),
      )

      // What an incremental blob sync asks for: only what landed after its cursor.
      const sinceMid = await asSyncer.call(com.atproto.space.listBlobs, {
        space,
        repo: alice.did,
        since: midRev,
      })
      expect(sinceMid.cids).toEqual([getBlobCidString(second)])
    })

    it('scopes listBlobs to one space', async () => {
      const space = await sc.createSpace(alice, {
        skey: 'blobs-scoped',
        members: [carol],
      })
      const other = await sc.createSpace(alice, {
        skey: 'blobs-scoped-other',
        members: [carol],
      })

      const blob = await upload(alice, new Uint8Array([9, 9, 9]))
      await sc.write(alice, space, {
        rkey: 'scoped-blob',
        record: { $type: TEST_COLLECTION, text: 'blob', image: blob },
      })

      const cred = await sc.credentialFor(carol, other)
      const listed = await cred
        .clientFor(alice.pds)
        .call(com.atproto.space.listBlobs, { space: other, repo: alice.did })
      expect(listed.cids).toEqual([])
    })

    it('refuses a blob to a credential for another space', async () => {
      const space = await sc.createSpace(alice, {
        skey: 'blob-auth',
        members: [carol],
      })
      const other = await sc.createSpace(alice, {
        skey: 'blob-auth-other',
        members: [carol],
      })

      const blob = await upload(alice, new Uint8Array([4, 2]))
      const blobCid = getBlobCidString(blob)
      await sc.write(alice, space, {
        rkey: 'guarded',
        record: { $type: TEST_COLLECTION, text: 'guarded', image: blob },
      })

      const wrongCred = await sc.credentialFor(carol, other)
      const res = await wrongCred.fetch(
        `${network.pds.url}/xrpc/com.atproto.space.getBlob?space=${encodeURIComponent(space)}&repo=${alice.did}&cid=${blobCid}`,
      )
      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })
})
