import { randomBytes } from 'node:crypto'
import { TID } from '@atproto/common'
import type { TestNetworkNoAppView } from '@atproto/dev-env'
import { getBlobCidString } from '@atproto/lex-data'
import { LtHash } from '@atproto/space'
import type { NsidString, SpaceRefString } from '@atproto/syntax'
import { app, com } from '../../src/lexicons/index.js'
import {
  type Actor,
  type SpaceClient,
  TEST_COLLECTION,
  TEST_COLLECTION_ALT,
  createSpaceNetwork,
  record,
} from '../_space.js'

const { create, update, delete: del } = com.atproto.space.applyWrites

const createOp = (rkey: string, text = rkey) =>
  create.$build({
    collection: TEST_COLLECTION,
    rkey,
    value: record(TEST_COLLECTION, text),
  })

const upload = async (actor: Actor) => {
  const bytes = new Uint8Array(randomBytes(16))
  const { body } = await actor.client.uploadBlob(bytes, {
    headers: actor.headers,
    encoding: 'image/png',
  })
  return { blob: body.blob, cid: getBlobCidString(body.blob), bytes }
}

const withBlob = (
  { blob }: Awaited<ReturnType<typeof upload>>,
  text = 'with a blob',
) => ({ $type: TEST_COLLECTION, text, image: blob })

describe('space records', () => {
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

  const getRecord = (
    actor: Actor,
    space: SpaceRefString,
    rkey: string,
    collection: NsidString = TEST_COLLECTION,
  ) =>
    actor.client.call(
      com.atproto.space.getRecord,
      { space, repo: actor.did, collection, rkey },
      { headers: actor.headers },
    )

  const listRecords = (
    actor: Actor,
    space: SpaceRefString,
    params: { collection?: NsidString; limit?: number; cursor?: string } = {},
  ) =>
    actor.client.call(
      com.atproto.space.listRecords,
      { space, repo: actor.did, ...params },
      { headers: actor.headers },
    )

  const listRepoOps = async (actor: Actor, space: SpaceRefString) => {
    const { ops } = await actor.client.call(
      com.atproto.space.listRepoOps,
      { space, repo: actor.did },
      { headers: actor.headers },
    )
    return ops
  }

  const applyWrites = (
    actor: Actor,
    space: SpaceRefString,
    writes: com.atproto.space.applyWrites.$InputBody['writes'],
  ) =>
    actor.client.call(
      com.atproto.space.applyWrites,
      { space, repo: actor.did, writes },
      { headers: actor.headers },
    )

  describe('writes', () => {
    it("writes a record to the caller's own repo", async () => {
      const space = await sc.createSpace(alice, { members: [dan] })

      const { uri, cid } = await sc.write(dan, space, {
        rkey: 'mine',
        text: 'hello',
      })
      expect(uri).toBe(`${space}/${dan.did}/${TEST_COLLECTION}/mine`)
      await expect(getRecord(dan, space, 'mine')).resolves.toMatchObject({
        uri,
        cid,
        value: { text: 'hello' },
      })
      expect(await sc.latestCommit(dan, space)).toMatchObject({
        space,
        repo: dan.did,
      })
    })

    it("refuses a write to another account's repo", async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      const target = { space, repo: alice.did }
      const path = { ...target, collection: TEST_COLLECTION, rkey: 'self' }
      const opts = { headers: dan.headers }
      const writes = [
        () =>
          dan.client.call(
            com.atproto.space.createRecord,
            { ...path, record: record(TEST_COLLECTION) },
            opts,
          ),
        () =>
          dan.client.call(
            com.atproto.space.putRecord,
            { ...path, record: record(TEST_COLLECTION) },
            opts,
          ),
        () => dan.client.call(com.atproto.space.deleteRecord, path, opts),
        () =>
          dan.client.call(
            com.atproto.space.applyWrites,
            { ...target, writes: [] },
            opts,
          ),
        () => dan.client.call(com.atproto.space.clearRecords, target, opts),
      ]
      for (const write of writes) {
        await expect(write()).rejects.toMatchObject({
          error: 'Forbidden',
          message: 'repo must match authenticated user',
        })
      }
    })

    it("writes to another authority's space without checking it exists", async () => {
      const space = await sc.createSpace(alice, { ungoverned: true })

      const { cid } = await sc.write(bob, space, { rkey: 'first' })
      await expect(getRecord(bob, space, 'first')).resolves.toMatchObject({
        cid,
      })
    })

    it('refuses an authority write to its own space before it exists or once deleted', async () => {
      const skey = TID.nextStr()
      const space = await sc.createSpace(alice, { skey, ungoverned: true })
      await expect(sc.write(alice, space)).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })

      await sc.createSpace(alice, { skey })
      await sc.write(alice, space)

      await alice.client.call(
        com.atproto.space.deleteSpace,
        { space },
        { headers: alice.headers },
      )
      await expect(sc.write(alice, space)).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
    })

    it('deletes a record, logging the cid it replaced', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      const created = await sc.write(dan, space, { rkey: 'doomed' })

      await sc.del(dan, space, { rkey: 'doomed' })

      await expect(getRecord(dan, space, 'doomed')).rejects.toMatchObject({
        error: 'RecordNotFound',
      })
      expect((await listRepoOps(dan, space)).at(-1)).toMatchObject({
        rkey: 'doomed',
        cid: null,
        prev: created.cid,
      })
      await sc.expectCommitMatchesRecords(dan, space)
    })

    it('treats deleting an absent record as a no-op', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.del(dan, space, { rkey: 'never' })
      expect(await sc.latestCommit(dan, space)).toBeNull()

      await sc.write(dan, space, { rkey: 'once' })
      await sc.del(dan, space, { rkey: 'once' })
      const deleted = await sc.latestCommit(dan, space)
      await sc.del(dan, space, { rkey: 'once' })
      expect(await sc.latestCommit(dan, space)).toEqual(deleted)
    })
  })

  describe('putRecord', () => {
    it('creates a record that does not yet exist', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })

      const { uri } = await sc.put(dan, space, { rkey: 'new', text: 'first' })
      expect(uri).toBe(`${space}/${dan.did}/${TEST_COLLECTION}/new`)
      await expect(getRecord(dan, space, 'new')).resolves.toMatchObject({
        value: { text: 'first' },
      })
    })

    it('replaces an existing record, logging the cid it replaced', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      const created = await sc.put(dan, space, { rkey: 'over', text: 'first' })

      const updated = await sc.put(dan, space, {
        rkey: 'over',
        text: 'second',
      })

      await expect(getRecord(dan, space, 'over')).resolves.toMatchObject({
        cid: updated.cid,
        value: { text: 'second' },
      })
      expect((await listRepoOps(dan, space)).at(-1)).toMatchObject({
        cid: updated.cid,
        prev: created.cid,
      })
      await sc.expectCommitMatchesRecords(dan, space)
    })
  })

  describe('applyWrites', () => {
    it('applies a batch as one rev', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })

      await applyWrites(
        dan,
        space,
        ['a', 'b', 'c'].map((rkey) => createOp(rkey)),
      )

      const ops = await listRepoOps(dan, space)
      expect(ops.map((op) => op.rkey)).toEqual(['a', 'b', 'c'])
      expect(new Set(ops.map((op) => op.rev)).size).toBe(1)
    })

    it('applies dependent writes within one batch', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })

      await applyWrites(dan, space, [
        createOp('dependent', 'first'),
        update.$build({
          collection: TEST_COLLECTION,
          rkey: 'dependent',
          value: record(TEST_COLLECTION, 'second'),
        }),
        createOp('survivor'),
        del.$build({ collection: TEST_COLLECTION, rkey: 'dependent' }),
      ])

      const { records } = await listRecords(dan, space)
      expect(records.map((r) => r.rkey)).toEqual(['survivor'])
      await sc.expectCommitMatchesRecords(dan, space)
    })

    it('rejects a duplicate create within one batch, writing nothing', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })

      await expect(
        applyWrites(dan, space, [createOp('dupe'), createOp('dupe')]),
      ).rejects.toMatchObject({ error: 'RecordAlreadyExists' })
      expect(await sc.latestCommit(dan, space)).toBeNull()
    })

    it('writes nothing for an empty batch', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })

      await expect(applyWrites(dan, space, [])).resolves.toEqual({
        results: [],
      })
      expect(await sc.latestCommit(dan, space)).toBeNull()
    })

    it('reports each result against the write it came from', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.write(dan, space, { rkey: 'doomed' })

      const { results } = await applyWrites(dan, space, [
        createOp('first'),
        del.$build({ collection: TEST_COLLECTION, rkey: 'doomed' }),
        createOp('last'),
      ])

      const { createResult, deleteResult } = com.atproto.space.applyWrites
      const uri = (rkey: string) =>
        `${space}/${dan.did}/${TEST_COLLECTION}/${rkey}`
      expect(results).toMatchObject([
        { $type: createResult.$type, uri: uri('first') },
        { $type: deleteResult.$type },
        { $type: createResult.$type, uri: uri('last') },
      ])
    })

    it('refuses a batch over the write limit', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      const writes = Array.from({ length: 201 }, (_, i) => createOp(`w${i}`))

      await expect(applyWrites(dan, space, writes)).rejects.toMatchObject({
        error: 'InvalidRequest',
        message: 'Too many writes. Max: 200',
      })
    })
  })

  describe('clearRecords', () => {
    it('deletes every record and empties the oplog at a new rev', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.write(dan, space, { rkey: 'one' })
      await sc.write(dan, space, {
        collection: TEST_COLLECTION_ALT,
        rkey: 'two',
      })
      const before = await sc.latestCommit(dan, space)

      await sc.clear(dan, space)

      expect((await listRecords(dan, space)).records).toEqual([])
      expect(await listRepoOps(dan, space)).toEqual([])
      const after = await sc.latestCommit(dan, space)
      expect(after!.rev > before!.rev).toBe(true)
      expect(after!.data).toEqual(new LtHash().digest())
    })

    it('is a no-op on an empty or unwritten repo', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.clear(dan, space)
      expect(await sc.latestCommit(dan, space)).toBeNull()

      await sc.write(dan, space, { rkey: 'gone' })
      await sc.del(dan, space, { rkey: 'gone' })
      const emptied = await sc.latestCommit(dan, space)
      await sc.clear(dan, space)
      expect(await sc.latestCommit(dan, space)).toEqual(emptied)
    })

    it('starts a fresh oplog on the next write', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.write(dan, space, { rkey: 'before' })
      await sc.clear(dan, space)
      const cleared = await sc.latestCommit(dan, space)

      const created = await sc.write(dan, space, { rkey: 'after' })

      expect(await listRepoOps(dan, space)).toMatchObject([
        { rkey: 'after', cid: created.cid, prev: null },
      ])
      const latest = await sc.latestCommit(dan, space)
      expect(latest!.rev > cleared!.rev).toBe(true)
    })

    it("leaves the account's repos in other spaces alone", async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      const other = await sc.createSpace(alice, { members: [dan] })
      await sc.write(dan, space, { rkey: 'cleared' })
      await sc.write(dan, other, { rkey: 'kept' })

      await sc.clear(dan, space)

      const { records } = await listRecords(dan, other)
      expect(records.map((r) => r.rkey)).toEqual(['kept'])
    })
  })

  describe('validation', () => {
    it('refuses a record whose $type disagrees with its collection', async () => {
      const space = await sc.createSpace(alice)
      await expect(
        sc.write(alice, space, { record: record(TEST_COLLECTION_ALT) }),
      ).rejects.toMatchObject({
        error: 'InvalidRequest',
        message: `Invalid $type: expected ${TEST_COLLECTION}, got ${TEST_COLLECTION_ALT}`,
      })
    })

    it('reports unknown for a collection with no resolvable schema', async () => {
      const space = await sc.createSpace(alice)
      await expect(sc.write(alice, space)).resolves.toMatchObject({
        validationStatus: 'unknown',
      })
    })

    it('refuses an unvalidatable record when validation is demanded', async () => {
      const space = await sc.createSpace(alice)
      await expect(
        sc.write(alice, space, { validate: true }),
      ).rejects.toMatchObject({
        error: 'InvalidRequest',
        message: `Unknown lexicon type: ${TEST_COLLECTION}`,
      })
    })

    // @TODO remove before beta, with the alpha form.
    it('refuses a space param in its alpha form', async () => {
      // Lenient validation still reads `at://{spaceDid}/space/...`, so records
      // written in the alpha stay valid, but params are validated strictly, and
      // handlers look a space up as given.
      const space = await sc.createSpace(alice)
      const legacy = space.replace(/^at:space\/([^/]+)\//, 'at://$1/space/')
      await expect(
        sc.write(alice, legacy as SpaceRefString),
      ).rejects.toMatchObject({ error: 'InvalidRequest' })
    })
  })

  describe('listRecords', () => {
    it('paginates across collections', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.write(dan, space, { collection: TEST_COLLECTION, rkey: 'a' })
      await sc.write(dan, space, { collection: TEST_COLLECTION_ALT, rkey: 'b' })

      const first = await listRecords(dan, space, { limit: 1 })
      const second = await listRecords(dan, space, {
        limit: 1,
        cursor: first.cursor,
      })
      const third = await listRecords(dan, space, {
        limit: 1,
        cursor: second.cursor,
      })
      expect(
        [first, second, third].map((page) => page.records.map((r) => r.rkey)),
      ).toEqual([['a'], ['b'], []])
      expect(third.cursor).toBeUndefined()
    })

    it('filters to one collection', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.write(dan, space, { collection: TEST_COLLECTION, rkey: 'a' })
      await sc.write(dan, space, { collection: TEST_COLLECTION_ALT, rkey: 'b' })

      const { records } = await listRecords(dan, space, {
        collection: TEST_COLLECTION_ALT,
      })
      expect(records).toMatchObject([
        { collection: TEST_COLLECTION_ALT, rkey: 'b' },
      ])
    })

    it('scopes a listing to one space', async () => {
      const space = await sc.createSpace(alice)
      const other = await sc.createSpace(alice)
      await sc.write(alice, space)

      expect((await listRecords(alice, other)).records).toEqual([])
    })
  })

  describe('getRecord', () => {
    it('reports RecordNotFound for a record that never existed', async () => {
      const space = await sc.createSpace(alice)
      await sc.write(alice, space, { rkey: 'present' })

      await expect(getRecord(alice, space, 'absent')).rejects.toMatchObject({
        error: 'RecordNotFound',
      })
    })
  })

  describe('blobs', () => {
    const getPublicBlob = (actor: Actor, cid: string) =>
      actor.client.xrpc(com.atproto.sync.getBlob, {
        params: { did: actor.did, cid },
      })

    it('serves and lists the blobs a space record references, to a syncer', async () => {
      const space = await sc.createSpace(alice, { members: [carol] })
      const first = await upload(alice)
      const second = await upload(alice)
      await sc.write(alice, space, { record: withBlob(first) })
      await sc.write(alice, space, { record: withBlob(second) })

      const cred = await sc.credentialFor(carol, space)
      const client = cred.clientFor(alice.pds)
      const params = { space, repo: alice.did }
      await expect(
        client.call(com.atproto.space.listBlobs, params),
      ).resolves.toEqual({ cids: [first.cid, second.cid].sort() })
      await expect(
        client.xrpc(com.atproto.space.getBlob, {
          params: { ...params, cid: first.cid },
        }),
      ).resolves.toMatchObject({ body: first.bytes })
    })

    it('does not serve a space-only blob through public sync', async () => {
      const space = await sc.createSpace(alice)
      const blob = await upload(alice)
      await sc.write(alice, space, { record: withBlob(blob) })

      const { cids } = await alice.client.call(com.atproto.sync.listBlobs, {
        did: alice.did,
      })
      expect(cids).not.toContain(blob.cid)
      await expect(getPublicBlob(alice, blob.cid)).rejects.toMatchObject({
        error: 'BlobNotFound',
      })
    })

    it('keeps a blob shared with a public record', async () => {
      const space = await sc.createSpace(alice)
      const blob = await upload(alice)
      const profile = {
        repo: alice.did,
        collection: app.bsky.actor.profile.$nsid,
        rkey: 'self',
      } as const
      await alice.client.call(
        com.atproto.repo.createRecord,
        {
          ...profile,
          record: app.bsky.actor.profile.$build({ avatar: blob.blob }),
        },
        { headers: alice.headers },
      )
      await sc.write(alice, space, { rkey: 'shared', record: withBlob(blob) })
      await expect(getPublicBlob(alice, blob.cid)).resolves.toMatchObject({
        body: blob.bytes,
      })

      await alice.client.call(com.atproto.repo.deleteRecord, profile, {
        headers: alice.headers,
      })
      await expect(getPublicBlob(alice, blob.cid)).rejects.toMatchObject({
        error: 'BlobNotFound',
      })
      expect(await sc.blobExists(alice, blob.cid)).toBe(true)

      await sc.del(alice, space, { rkey: 'shared' })
      expect(await sc.blobExists(alice, blob.cid)).toBe(false)
    })

    it('releases a blob a replacing record no longer references', async () => {
      const space = await sc.createSpace(alice)
      const replaced = await upload(alice)
      const current = await upload(alice)
      await sc.put(alice, space, { record: withBlob(replaced) })

      await sc.put(alice, space, { record: withBlob(current) })

      expect(await sc.blobExists(alice, replaced.cid)).toBe(false)
      expect(await sc.blobExists(alice, current.cid)).toBe(true)
    })

    it('keeps a blob a replacing record still references', async () => {
      const space = await sc.createSpace(alice)
      const blob = await upload(alice)
      await sc.put(alice, space, { record: withBlob(blob, 'first') })

      await sc.put(alice, space, { record: withBlob(blob, 'second') })

      expect(await sc.blobExists(alice, blob.cid)).toBe(true)
    })

    it('drops the blobs of cleared records', async () => {
      const space = await sc.createSpace(alice)
      const blob = await upload(alice)
      await sc.write(alice, space, { record: withBlob(blob) })

      await sc.clear(alice, space)

      expect(await sc.blobExists(alice, blob.cid)).toBe(false)
    })

    it('scopes listBlobs to one space', async () => {
      const space = await sc.createSpace(alice, { members: [carol] })
      const other = await sc.createSpace(alice, { members: [carol] })
      await sc.write(alice, space, { record: withBlob(await upload(alice)) })

      const cred = await sc.credentialFor(carol, other)
      await expect(
        cred
          .clientFor(alice.pds)
          .call(com.atproto.space.listBlobs, { space: other, repo: alice.did }),
      ).resolves.toEqual({ cids: [] })
    })

    it('refuses a blob the authorized space does not reference', async () => {
      const space = await sc.createSpace(alice, { members: [carol] })
      const other = await sc.createSpace(alice, { members: [carol] })
      const blob = await upload(alice)
      await sc.write(alice, space, { record: withBlob(blob) })

      const cred = await sc.credentialFor(carol, other)
      await expect(
        cred.clientFor(alice.pds).xrpc(com.atproto.space.getBlob, {
          params: { space: other, repo: alice.did, cid: blob.cid },
        }),
      ).rejects.toMatchObject({ error: 'BlobNotFound' })
    })
  })
})
