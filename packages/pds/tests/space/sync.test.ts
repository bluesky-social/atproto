import { jest } from '@jest/globals'
import { sql } from 'kysely'
import { MINUTE, TID } from '@atproto/common'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { parseCid } from '@atproto/lex-data'
import {
  LtHash,
  RepoCommit,
  type SignedCommit,
  spaceHostAud,
  verifyRepoCarFull,
} from '@atproto/space'
import type { NsidString, SpaceRefString } from '@atproto/syntax'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import { getDb, getMigrator } from '../../src/actor-store/db/index.js'
import { resolveServiceEndpoint } from '../../src/api/com/atproto/space/util.js'
import { com } from '../../src/lexicons/index.js'
import { SpaceNotifications } from '../../src/space-notifications.js'
import {
  type Actor,
  MockService,
  SpaceClient,
  TEST_COLLECTION,
  TEST_COLLECTION_ALT,
} from '../_space.js'

/**
 * The wire `signedCommit` types `ver` as a number, while the package's own
 * `SignedCommit` narrows it to the literal 1. They describe the same bytes, so
 * this asserts the version and hands back the narrower type rather than casting
 * blindly at four call sites.
 */
const asSignedCommit = (commit: {
  ver: number
  hash: Uint8Array
  ikm: Uint8Array
  sig: Uint8Array
  mac: Uint8Array
  rev: string
}): SignedCommit => {
  expect(commit.ver).toBe(1)
  return commit as SignedCommit
}

/**
 * How a syncing service follows a space.
 *
 * The oplog is the incremental path: page forward from a cursor, apply each op to
 * a local set hash, and check it against the repo's signed commit. When the oplog
 * no longer reaches back far enough, `listRecords` + `getLatestCommit` (or a
 * `getRepo` CAR) rebuilds from full state.
 */
describe('space sync', () => {
  let network: TestNetworkNoAppView
  let sc: SpaceClient
  let alice: Actor // authority
  let dan: Actor // member on the authority's PDS
  let bob: Actor // member on pds2
  let carol: Actor // stands in for a syncing service, on pds3

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'space_sync',
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

  describe('oplog paging', () => {
    it('pages through a single rev without dropping ops', async () => {
      // One batch is one rev, so a page boundary can land inside it. The cursor
      // carries (rev, idx), so resuming picks up mid-rev rather than re-reading
      // or skipping the rest of it.
      const space = await sc.createSpace(alice, { members: [dan] })
      await dan.client.call(
        com.atproto.space.applyWrites,
        {
          space,
          repo: dan.did,
          writes: [0, 1, 2, 3, 4].map((i) => ({
            $type: 'com.atproto.space.applyWrites#create' as const,
            collection: TEST_COLLECTION,
            rkey: `atomic-${i}`,
            value: { $type: TEST_COLLECTION, text: `atomic ${i}` },
          })),
        },
        { headers: dan.headers },
      )

      const cred = await sc.credentialFor(dan, space)
      const asSyncer = cred.clientFor(dan.pds)
      const rkeys: string[] = []
      let cursor: string | undefined
      for (let i = 0; i < 10; i++) {
        const page = await asSyncer.call(com.atproto.space.listRepoOps, {
          space,
          repo: dan.did,
          limit: 2,
          cursor,
        })
        rkeys.push(...page.ops.map((op) => op.rkey))
        cursor = page.cursor
        if (!cursor) break
      }
      expect(rkeys).toEqual([0, 1, 2, 3, 4].map((i) => `atomic-${i}`))
    })

    it('withholds the commit until the oplog is drained to head', async () => {
      // The commit is the syncer's checkpoint, so handing it out mid-backfill
      // would let it believe it had caught up.
      const space = await sc.createSpace(alice, { members: [dan] })
      for (const i of [0, 1, 2]) {
        await sc.write(dan, space, { rkey: `paged-${i}` })
      }

      const cred = await sc.credentialFor(dan, space)
      const asSyncer = cred.clientFor(dan.pds)
      const first = await asSyncer.call(com.atproto.space.listRepoOps, {
        space,
        repo: dan.did,
        limit: 1,
      })
      expect(first.commit).toBeUndefined()
      expect(first.cursor).toBeDefined()

      let cursor = first.cursor
      let commit: unknown
      const seen = [first.ops[0].rev]
      for (let i = 0; i < 5 && cursor; i++) {
        const next = await asSyncer.call(com.atproto.space.listRepoOps, {
          space,
          repo: dan.did,
          cursor,
          limit: 1,
        })
        if (next.ops[0]) seen.push(next.ops[0].rev)
        cursor = next.cursor
        commit = next.commit
      }
      // Each page advances: paging on a cursor that was ignored would repeat a rev.
      expect(new Set(seen).size).toBe(seen.length)
      expect(commit).toBeDefined()
    })

    it('pages with since and cursor together', async () => {
      // A syncer holds `since` at its own last-synced position and passes back
      // each `cursor`, so the two have to compose rather than one overriding the
      // other.
      const space = await sc.createSpace(alice, { members: [dan] })
      for (const i of [0, 1, 2, 3]) {
        await sc.write(dan, space, { rkey: `prec-${i}` })
      }

      const cred = await sc.credentialFor(dan, space)
      const asSyncer = cred.clientFor(dan.pds)
      const all = await asSyncer.call(com.atproto.space.listRepoOps, {
        space,
        repo: dan.did,
        limit: 100,
      })
      expect(all.ops).toHaveLength(4)

      // Synced through op 0; page the rest one at a time, holding `since` steady.
      const since = all.ops[0].rev
      const rkeys: string[] = []
      let cursor: string | undefined
      for (let i = 0; i < 10; i++) {
        const page = await asSyncer.call(com.atproto.space.listRepoOps, {
          space,
          repo: dan.did,
          since,
          cursor,
          limit: 1,
        })
        rkeys.push(...page.ops.map((op) => op.rkey))
        cursor = page.cursor
        if (!cursor) break
      }
      expect(rkeys).toEqual(['prec-1', 'prec-2', 'prec-3'])
    })

    it('inlines only a record current value', async () => {
      // The oplog join matches on cid as well as uri, so an op a later one
      // superseded inlines nothing rather than serving a stale value.
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.put(dan, space, { rkey: 'inlined', text: 'first' })
      await sc.put(dan, space, { rkey: 'inlined', text: 'second' })

      const cred = await sc.credentialFor(dan, space)
      const asSyncer = cred.clientFor(dan.pds)
      const { ops } = await asSyncer.call(com.atproto.space.listRepoOps, {
        space,
        repo: dan.did,
        limit: 100,
      })
      expect(ops).toHaveLength(2)
      expect(ops[0].value).toBeUndefined()
      expect(ops[1].value).toMatchObject({ text: 'second' })
    })

    it('omits values entirely with excludeValues', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.write(dan, space, { rkey: 'no-value', text: 'body' })

      const cred = await sc.credentialFor(dan, space)
      const asSyncer = cred.clientFor(dan.pds)
      const { ops } = await asSyncer.call(com.atproto.space.listRepoOps, {
        space,
        repo: dan.did,
        excludeValues: true,
      })
      expect(ops).toHaveLength(1)
      expect(ops[0].value).toBeUndefined()
      // The op still names the record, so a syncer can fetch what it needs.
      expect(ops[0]).toMatchObject({ rkey: 'no-value' })
    })

    it('rejects a malformed cursor', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.write(dan, space, { rkey: 'cursor-check' })
      const cred = await sc.credentialFor(dan, space)
      const asSyncer = cred.clientFor(dan.pds)

      await expect(
        asSyncer.call(com.atproto.space.listRepoOps, {
          space,
          repo: dan.did,
          cursor: 'not-a-cursor',
        }),
      ).rejects.toMatchObject({ error: 'MalformedCursor' })
    })
  })

  describe('incremental catch-up', () => {
    it('replays the oplog to the repo signed commit', async () => {
      // The whole point of the oplog: a syncer that applies every op ends up with
      // a set hash matching what the author signed.
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.write(dan, space, { rkey: 'one', text: 'one' })
      await sc.put(dan, space, { rkey: 'two', text: 'two' })
      await sc.put(dan, space, { rkey: 'two', text: 'two revised' })
      await sc.del(dan, space, { rkey: 'one' })

      const cred = await sc.credentialFor(dan, space)
      const asSyncer = cred.clientFor(dan.pds)
      const { ops, commit } = await asSyncer.call(
        com.atproto.space.listRepoOps,
        { space, repo: dan.did, limit: 100 },
      )
      expect(commit).toBeDefined()

      const local = new RepoCommit()
      for (const op of ops) {
        local.applyOp({
          collection: op.collection,
          rkey: op.rkey,
          cid: op.cid ? parseCid(op.cid) : null,
          prev: op.prev ? parseCid(op.prev) : null,
        })
      }
      expect(local.matches(asSignedCommit(commit!))).toBe(true)
    })

    it('detects divergence when an op is missed', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.write(dan, space, { rkey: 'kept', text: 'kept' })
      await sc.write(dan, space, { rkey: 'missed', text: 'missed' })

      const cred = await sc.credentialFor(dan, space)
      const asSyncer = cred.clientFor(dan.pds)
      const { ops, commit } = await asSyncer.call(
        com.atproto.space.listRepoOps,
        { space, repo: dan.did, limit: 100 },
      )

      // Apply all but the last: the mismatch is what tells a syncer to recover.
      const local = new RepoCommit()
      for (const op of ops.slice(0, -1)) {
        local.applyOp({
          collection: op.collection,
          rkey: op.rkey,
          cid: op.cid ? parseCid(op.cid) : null,
          prev: op.prev ? parseCid(op.prev) : null,
        })
      }
      expect(local.matches(asSignedCommit(commit!))).toBe(false)
    })

    // Known gap: the recovery path below is tested by forcing a prune by hand,
    // because nothing prunes on its own yet. There is no retention window, no
    // compaction, and so no bound on oplog growth.
    it.todo('prunes the oplog on its own, past a retention window')

    it('recovers from a pruned oplog via listRecords', async () => {
      // When the oplog no longer reaches back to a consumer's cursor, an
      // incremental pull yields an incomplete diff — detectable as a setHash
      // mismatch. Recovery is listRecords + getLatestCommit; no new endpoint.
      const space = await sc.createSpace(alice, { members: [bob] })

      for (const text of ['pre 1', 'pre 2', 'pre 3']) {
        await sc.write(bob, space, { text })
      }
      const consumerSince = (await sc.repoState(bob, space))!.rev!

      await sc.write(bob, space, { text: 'post 1' })
      await sc.write(bob, space, { text: 'post 2' })

      // Simulate retention by dropping oplog rows at or below the cursor. No
      // endpoint prunes, so this reaches into storage deliberately.
      await bob.pds.ctx.actorStore.transact(bob.did, async (txn) => {
        await txn.space.db.db
          .deleteFrom('space_record_oplog')
          .where('space', '=', space)
          .where('rev', '<=', consumerSince)
          .execute()
      })

      const cred = await sc.credentialFor(bob, space)
      const asSyncer = cred.clientFor(bob.pds)
      const incremental = await asSyncer.call(com.atproto.space.listRepoOps, {
        space,
        repo: bob.did,
        since: consumerSince,
        limit: 100,
      })
      expect(incremental.ops).toHaveLength(2)

      const applied = new RepoCommit()
      for (const op of incremental.ops) {
        applied.applyOp({
          collection: op.collection,
          rkey: op.rkey,
          cid: op.cid ? parseCid(op.cid) : null,
          prev: op.prev ? parseCid(op.prev) : null,
        })
      }
      expect(applied.matches(asSignedCommit(incremental.commit!))).toBe(false)

      // Recovery: page listRecords across all collections, recompute, compare.
      const recovered: { collection: NsidString; rkey: string; cid: string }[] =
        []
      let cursor: string | undefined
      for (let page = 0; page < 10; page++) {
        const res = await asSyncer.call(com.atproto.space.listRecords, {
          space,
          repo: bob.did,
          limit: 2,
          cursor,
        })
        recovered.push(
          ...res.records.map((r) => ({
            collection: r.collection,
            rkey: r.rkey,
            cid: r.cid,
          })),
        )
        cursor = res.cursor
        if (!cursor) break
      }
      expect(recovered).toHaveLength(5)

      const rebuilt = RepoCommit.fromRecords(
        recovered.map((r) => ({
          collection: r.collection,
          rkey: r.rkey,
          cid: parseCid(r.cid),
        })),
      )
      const latest = await asSyncer.call(com.atproto.space.getLatestCommit, {
        space,
        repo: bob.did,
      })
      expect(rebuilt.matches(asSignedCommit(latest.commit))).toBe(true)
    })
  })

  describe('getRepo', () => {
    it('serves a verifiable CAR for full-state recovery', async () => {
      const space = await sc.createSpace(alice, { members: [bob, carol] })
      for (const collection of [TEST_COLLECTION, TEST_COLLECTION_ALT]) {
        for (const i of [0, 1]) {
          await sc.write(bob, space, {
            collection,
            rkey: `car-${i}`,
            text: `car ${i}`,
          })
        }
      }

      // Carol syncs bob's repo in full, as a syncing service would.
      const cred = await sc.credentialFor(carol, space)
      const res = await cred.fetch(
        `${bob.pds.url}/xrpc/com.atproto.space.getRepo?space=${encodeURIComponent(space)}&repo=${bob.did}`,
      )
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain(
        'application/vnd.ipld.car',
      )
      const car = new Uint8Array(await res.arrayBuffer())

      const didKey = (await bob.pds.ctx.actorStore.keypair(bob.did)).did()
      const state = await sc.repoState(bob, space)
      const recovered = await verifyRepoCarFull([car], {
        space,
        author: bob.did,
        didKey,
      })

      expect(recovered.records).toHaveLength(4)
      expect(recovered.repo.matches(recovered.commit)).toBe(true)
      expect(recovered.commit.rev).toBe(state?.rev)
      expect(
        recovered.repo.setHash.equals(
          RepoCommit.fromState(state?.setHash).setHash,
        ),
      ).toBe(true)

      const texts = recovered.records
        .filter((r) => r.collection === TEST_COLLECTION)
        .map((r) => (r.record as { text: string }).text)
        .sort()
      expect(texts).toEqual(['car 0', 'car 1'])
    })

    it('serves an index-only CAR with excludeValues', async () => {
      const space = await sc.createSpace(alice, { members: [bob, carol] })
      for (const i of [0, 1]) {
        await sc.write(bob, space, { rkey: `idx-${i}`, text: `idx ${i}` })
      }

      const cred = await sc.credentialFor(carol, space)
      const res = await cred.fetch(
        `${bob.pds.url}/xrpc/com.atproto.space.getRepo?space=${encodeURIComponent(space)}&repo=${bob.did}&excludeValues=true`,
      )
      expect(res.status).toBe(200)
      const car = new Uint8Array(await res.arrayBuffer())

      // The set hash folds from the index alone, so it still matches the commit
      // with no record blocks present — which is what makes an index-only sync
      // verifiable.
      const didKey = (await bob.pds.ctx.actorStore.keypair(bob.did)).did()
      const recovered = await verifyRepoCarFull([car], {
        space,
        author: bob.did,
        didKey,
        expectValues: false,
      })
      expect(recovered.records).toHaveLength(0)
      expect(Object.keys(recovered.index)).toHaveLength(2)
      expect(recovered.repo.matches(recovered.commit)).toBe(true)
    })

    it('refuses a CAR without a credential for that space', async () => {
      const space = await sc.createSpace(alice, {
        skey: 'car-auth',
        members: [bob],
      })
      const other = await sc.createSpace(alice, {
        skey: 'car-auth-other',
        members: [carol],
      })

      const wrongCred = await sc.credentialFor(carol, other)
      const res = await wrongCred.fetch(
        `${bob.pds.url}/xrpc/com.atproto.space.getRepo?space=${encodeURIComponent(space)}&repo=${bob.did}`,
      )
      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    it('reports RepoNotFound for an unwritten repo', async () => {
      const space = await sc.createSpace(alice, { members: [carol] })
      const cred = await sc.credentialFor(carol, space)
      await expect(
        cred.clientFor(alice.pds).call(com.atproto.space.getLatestCommit, {
          space,
          repo: alice.did,
        }),
      ).rejects.toMatchObject({ error: 'RepoNotFound' })
    })
  })

  describe('writer set', () => {
    it('records a co-located writer without resolving its public PDS endpoint', async () => {
      const space = await sc.createSpace(alice, {
        writePolicy: com.atproto.simplespace.defs.publicPolicy.build({}),
      })
      using resolveDid = jest
        .spyOn(network.pds.ctx.idResolver.did, 'resolve')
        .mockRejectedValue(new Error('public endpoint is unreachable'))

      await sc.write(dan, space, { text: 'same PDS' })

      expect(resolveDid).not.toHaveBeenCalled()
      expect(await sc.writerDids(space)).toEqual([dan.did])
    })

    it('records a writer from notifyWrite, and it is not the member list', async () => {
      const space = await sc.createSpace(alice, { members: [bob] })

      // Bob writes on pds2; his PDS delivers notifyWrite at the
      // authority, which records him in the writer set.
      await sc.write(bob, space, { text: 'writer set entry' })

      const cred = await sc.credentialFor(bob, space)
      const asSyncer = cred.clientFor(alice.pds)
      const repos = await sc.awaitNotify(
        () => asSyncer.call(com.atproto.space.listRepos, { space }),
        (res) => res.repos.some((r) => r.did === bob.did),
      )
      const dids = repos.repos.map((r) => r.did)
      expect(dids).toContain(bob.did)
      // Alice is a member who hasn't written, so she is absent: the writer set is
      // the sync boundary, not the membership list.
      expect(dids).not.toContain(alice.did)

      // And it carries where each writer is up to, so a syncer knows what to pull.
      const entry = repos.repos.find((r) => r.did === bob.did)!
      const state = await sc.repoState(bob, space)
      expect(entry.repoRev).toBe(state!.rev)
      expect(entry.hash).toEqual(new LtHash(state!.setHash!).digest())
    })

    it('records a writer admitted by public write policy, who was never a member', async () => {
      const space = await sc.createSpace(alice, {
        writePolicy: com.atproto.simplespace.defs.publicPolicy.build({}),
      })
      await sc.write(bob, space, { text: 'from a non-member' })

      await sc.awaitNotify(
        () => sc.writerDids(space),
        (dids) => dids.includes(bob.did),
      )
      await sc.expectWriterSet(space, alice, [bob])
    })

    it('records a writer into an allowList space, whose PDS presents no attestation', async () => {
      // notifyWrite comes from the writer's PDS, not an app, so there is no
      // client attestation to present. Applying the app perimeter here would
      // reject every write into an app-gated space.
      const space = await sc.createSpace(alice, {
        members: [bob],
        appAccess: com.atproto.simplespace.defs.allowList.build({
          allowed: ['https://app.example.com/client-metadata.json'],
        }),
      })
      await sc.write(bob, space, { text: 'app-gated space' })

      await sc.awaitNotify(
        () => sc.writerDids(space),
        (dids) => dids.includes(bob.did),
      )
      expect(await sc.writerDids(space)).toContain(bob.did)
    })
  })

  it('migrates existing writer state', async () => {
    const space = await sc.createSpace(alice, { members: [bob, dan] })
    await sc.write(bob, space)
    await sc.write(dan, space)
    const bobState = (await sc.repoState(bob, space))!
    const db = getDb(':memory:')
    try {
      const migrator = getMigrator(db)
      await migrator.migrateToOrThrow('003')
      await sql`
        insert into space (uri, authority, type, createdAt, deletedAt)
        values (${space}, ${alice.did}, 'com.example.group', '2026-01-01T00:00:00Z', null)
      `.execute(db.db)
      await sql`
        insert into space_repo (space, rev, setHash)
        values (${space}, ${bobState.rev}, ${bobState.setHash})
      `.execute(db.db)
      for (const actor of [bob, dan]) {
        await sql`
          insert into space_writer (space, did, rev, hash)
          values (${space}, ${actor.did}, ${bobState.rev}, ${new LtHash().digest()})
        `.execute(db.db)
      }

      await migrator.migrateToLatestOrThrow()
      const writers = await db.db
        .selectFrom('space_writer')
        .selectAll()
        .orderBy('spaceRev')
        .execute()
      expect(writers).toHaveLength(2)
      expect(writers.map((writer) => writer.repoRev)).toEqual([
        bobState.rev,
        bobState.rev,
      ])
      expect(writers.map((writer) => writer.spaceRev)).toEqual([
        bobState.rev,
        bobState.rev,
      ])
      const repo = await db.db
        .selectFrom('space_repo')
        .selectAll()
        .executeTakeFirstOrThrow()
      expect(repo.rev).toBe(bobState.rev)
      await migrator.migrateToOrThrow('003')
      await migrator.migrateToLatestOrThrow()
    } finally {
      db.close()
    }
  })

  describe('space catch-up', () => {
    it('recovers missed notifications with a space checkpoint', async () => {
      await using syncer = await MockService.create(network, {
        serviceId: 'atproto_space_syncer',
        respond: () => ({ status: 503, body: {} }),
      })
      const space = await sc.createSpace(alice, { members: [bob, dan, carol] })
      const cred = await sc.credentialFor(carol, space)
      const client = cred.clientFor(alice.pds)
      await client.call(com.atproto.space.registerNotify, {
        space,
        service: syncer.serviceRef,
      })
      const empty = await client.call(com.atproto.space.listRepos, { space })
      expect(empty.repos).toEqual([])

      await sc.write(bob, space)
      const initial = await client.call(com.atproto.space.listRepos, { space })
      const cursor = initial.cursor
      expect(cursor).toBe(initial.repos.at(-1)!.spaceRev)
      await sc.write(dan, space)
      await sc.write(bob, space)
      await alice.pds.ctx.backgroundQueue.processAll()

      const first = await client.call(com.atproto.space.listRepos, {
        space,
        cursor,
        limit: 1,
      })
      expect(first.repos.map((r) => r.did)).toEqual([dan.did])

      // @NOTE A repo already returned can move forward while the caller paginates.
      await sc.write(dan, space)
      const second = await client.call(com.atproto.space.listRepos, {
        space,
        cursor: first.cursor,
        limit: 1,
      })
      expect(second.repos.map((r) => r.did)).toEqual([bob.did])
      const last = await client.call(com.atproto.space.listRepos, {
        space,
        cursor: second.cursor,
        limit: 1,
      })
      expect(last.repos.map((r) => r.did)).toEqual([dan.did])
      const nextCursor = last.cursor
      expect(nextCursor).toBe(last.repos.at(-1)!.spaceRev)
      const caughtUp = await client.call(com.atproto.space.listRepos, {
        space,
        cursor: nextCursor,
      })
      expect(caughtUp.repos).toEqual([])
      expect(caughtUp.cursor).toBeUndefined()
    })

    it('resumes after an empty page using the last processed repo revision', async () => {
      const space = await sc.createSpace(alice, { members: [bob] })
      await sc.write(bob, space)
      const cred = await sc.credentialFor(alice, space)
      const client = cred.clientFor(alice.pds)
      const initial = await client.call(com.atproto.space.listRepos, { space })
      let cursor = initial.cursor!
      const empty = await client.call(com.atproto.space.listRepos, {
        space,
        cursor,
      })
      expect(empty.repos).toEqual([])
      expect(empty.cursor).toBeUndefined()
      cursor = empty.cursor ?? cursor

      await sc.write(bob, space)
      const catchUp = await client.call(com.atproto.space.listRepos, {
        space,
        cursor,
      })
      expect(catchUp.repos.map((r) => r.did)).toEqual([bob.did])
      expect(catchUp.repos[0].spaceRev > cursor).toBe(true)
    })

    it('rejects malformed listRepos cursors', async () => {
      const space = await sc.createSpace(alice)
      const cred = await sc.credentialFor(alice, space)
      const params = com.atproto.space.listRepos.$params.toURLSearchParams({
        space,
      })
      params.set('cursor', 'not-a-tid')
      const response = await cred.fetch(
        `${alice.pds.url}/xrpc/${com.atproto.space.listRepos.$lxm}?${params}`,
      )
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ error: 'InvalidRequest' })
    })

    it('chains forwarded notifications across local and remote writers', async () => {
      await using syncer = await MockService.create(network, {
        serviceId: 'atproto_space_syncer',
      })
      const space = await sc.createSpace(alice, { members: [bob, dan, carol] })
      const cred = await sc.credentialFor(carol, space)
      const client = cred.clientFor(alice.pds)
      await client.call(com.atproto.space.registerNotify, {
        space,
        service: syncer.serviceRef,
      })
      await sc.write(alice, space)
      await Promise.all([sc.write(bob, space), sc.write(dan, space)])
      await alice.pds.ctx.backgroundQueue.processAll()
      const notifications = syncer
        .callsTo(com.atproto.space.notifyWrite.$lxm)
        .map((call) => call.body as com.atproto.space.notifyWrite.$InputBody)
        .sort((a, b) => a.spaceRev!.localeCompare(b.spaceRev!))
      expect(notifications).toHaveLength(3)
      expect(notifications[0].prevSpaceRev).toBeUndefined()
      expect(notifications[1].prevSpaceRev).toBe(notifications[0].spaceRev)
      expect(notifications[2].prevSpaceRev).toBe(notifications[1].spaceRev)
      const listed = await client.call(com.atproto.space.listRepos, { space })
      expect(listed.repos.at(-1)?.spaceRev).toBe(notifications[2].spaceRev)
      expect(new Set(listed.repos.map((r) => r.spaceRev)).size).toBe(3)
    })

    it('resolves a dedicated space host and falls back only when it is absent', async () => {
      await using host = await MockService.create(network, {
        serviceId: 'atproto_space_host',
      })
      const resolver = bob.pds.ctx.idResolver
      expect(await resolveServiceEndpoint(resolver, host.serviceRef)).toBe(
        host.url,
      )
      expect(
        await resolveServiceEndpoint(resolver, spaceHostAud(alice.did)),
      ).toBe(alice.pds.url)
      const doc = await resolver.did.resolve(alice.did)
      using _resolve = jest.spyOn(resolver.did, 'resolve').mockResolvedValue({
        ...doc!,
        service: [
          ...doc!.service!,
          {
            id: '#atproto_space_host',
            type: 'AtprotoSpaceHost',
            serviceEndpoint: 'invalid',
          },
        ],
      })
      expect(
        await resolveServiceEndpoint(resolver, spaceHostAud(alice.did)),
      ).toBeUndefined()
    })

    it('retries the latest state after delivery failure and worker restart', async () => {
      const space = await sc.createSpace(alice, { members: [bob] })
      {
        using resolve = jest
          .spyOn(bob.pds.ctx.idResolver.did, 'resolve')
          .mockRejectedValue(new Error('space host unavailable'))
        await sc.write(bob, space)
        await sc.write(bob, space)
        expect(resolve).toHaveBeenCalled()
        expect(await sc.writerDids(space)).toEqual([])
      }
      const state = (await sc.repoState(bob, space))!
      const db = bob.pds.ctx.accountManager.db.db
      expect(
        await db.selectFrom('space_notification_retry').selectAll().execute(),
      ).toEqual([
        expect.objectContaining({ repo: bob.did, space, repoRev: state.rev }),
      ])
      await bob.pds.ctx.spaceNotifications.destroy()
      await db
        .updateTable('space_notification_retry')
        .set({ retryAt: 0 })
        .execute()
      const restarted = new SpaceNotifications(bob.pds.ctx)
      bob.pds.ctx.spaceNotifications = restarted
      restarted.start()
      await restarted.retryPending()
      expect(
        await db.selectFrom('space_notification_retry').selectAll().execute(),
      ).toEqual([])
      const cred = await sc.credentialFor(bob, space)
      const listed = await cred
        .clientFor(alice.pds)
        .call(com.atproto.space.listRepos, { space })
      expect(listed.repos).toHaveLength(1)
      expect(listed.repos[0].repoRev).toBe(state.rev)
      expect(listed.repos[0].hash).toEqual(new LtHash(state.setHash!).digest())
      await restarted.retryPending()
      expect(
        await cred
          .clientFor(alice.pds)
          .call(com.atproto.space.listRepos, { space }),
      ).toEqual(listed)
    })
  })

  describe('notifyWrite', () => {
    const notify = async (
      signer: Actor,
      body: {
        space: SpaceRefString
        repo: string
        repoRev: string
        hash: Uint8Array
      },
      opts: { aud?: string } = {},
    ) => {
      const keypair = await signer.pds.ctx.actorStore.keypair(signer.did)
      const { headers } = await createServiceAuthHeaders({
        iss: signer.did,
        aud: opts.aud ?? spaceHostAud(alice.did),
        lxm: com.atproto.space.notifyWrite.$lxm,
        keypair,
      })
      return alice.client.call(com.atproto.space.notifyWrite, body as never, {
        headers,
      })
    }

    it('ignores duplicate and older revisions without forwarding them', async () => {
      await using syncer = await MockService.create(network, {
        serviceId: 'atproto_space_syncer',
      })
      const space = await sc.createSpace(alice, { members: [bob] })
      const cred = await sc.credentialFor(alice, space)
      const client = cred.clientFor(alice.pds)
      await client.call(com.atproto.space.registerNotify, {
        space,
        service: syncer.serviceRef,
      })
      await sc.write(bob, space)
      const older = (await sc.repoState(bob, space))!.rev!
      await sc.write(bob, space)
      await alice.pds.ctx.backgroundQueue.processAll()
      const before = await client.call(com.atproto.space.listRepos, { space })
      const calls = syncer.callsTo(com.atproto.space.notifyWrite.$lxm).length
      for (const repoRev of [older, before.repos[0].repoRev]) {
        await notify(bob, {
          space,
          repo: bob.did,
          repoRev,
          hash: new Uint8Array(32),
        })
      }
      await alice.pds.ctx.backgroundQueue.processAll()
      expect(await client.call(com.atproto.space.listRepos, { space })).toEqual(
        before,
      )
      expect(syncer.callsTo(com.atproto.space.notifyWrite.$lxm)).toHaveLength(
        calls,
      )
    })

    it('keeps the newest repo revision when notifications race', async () => {
      const space = await sc.createSpace(alice, { members: [bob] })
      const older = TID.nextStr()
      const newer = TID.nextStr(older)
      const hash = new LtHash().digest()
      await Promise.all([
        notify(bob, { space, repo: bob.did, repoRev: newer, hash }),
        notify(bob, {
          space,
          repo: bob.did,
          repoRev: older,
          hash: new Uint8Array(32),
        }),
      ])
      const cred = await sc.credentialFor(alice, space)
      const listed = await cred
        .clientFor(alice.pds)
        .call(com.atproto.space.listRepos, { space })
      expect(listed.repos).toHaveLength(1)
      expect(listed.repos[0]).toMatchObject({ repoRev: newer, hash })
    })

    it('rejects future revisions while allowing a small clock skew', async () => {
      const space = await sc.createSpace(alice, { members: [bob] })
      await expect(
        notify(bob, {
          space,
          repo: bob.did,
          repoRev: TID.fromTime(
            (Date.now() + 10 * MINUTE) * 1000,
            0,
          ).toString(),
          hash: new LtHash().digest(),
        }),
      ).rejects.toMatchObject({ error: 'FutureRev' })
      expect(await sc.writerDids(space)).toEqual([])
      await notify(bob, {
        space,
        repo: bob.did,
        repoRev: TID.fromTime((Date.now() + MINUTE) * 1000, 0).toString(),
        hash: new LtHash().digest(),
      })
      expect(await sc.writerDids(space)).toEqual([bob.did])
    })

    it('rejects one that spoofs the writer', async () => {
      // Bob signs but claims carol wrote. The authority refuses on iss ≠ repo,
      // which is what keeps a PDS from moving another account's sync position.
      const space = await sc.createSpace(alice, { members: [bob, carol] })
      await expect(
        notify(bob, {
          space,
          repo: carol.did,
          repoRev: TID.nextStr(),
          hash: new LtHash().digest(),
        }),
      ).rejects.toThrow(/iss does not match claimed writer/)
    })

    it('rejects one addressed to another authority', async () => {
      // Everything but the audience checks out: bob is a member signing for
      // himself, off a real write. Only the aud stands between him and moving
      // the writer set that listRepos publishes.
      const space = await sc.createSpace(alice, { members: [bob] })
      await sc.write(bob, space, { text: 'misaddressed' })
      const state = await sc.repoState(bob, space)

      await expect(
        notify(
          bob,
          {
            space,
            repo: bob.did,
            repoRev: state!.rev!,
            hash: new LtHash(state!.setHash!).digest(),
          },
          { aud: carol.did },
        ),
      ).rejects.toThrow(/aud does not match the space authority/)
    })

    it('rejects one from a non-member', async () => {
      // iss === repo, but the signer isn't admitted by the write policy.
      const space = await sc.createSpace(alice, { members: [bob] })
      await expect(
        notify(carol, {
          space,
          repo: carol.did,
          repoRev: TID.nextStr(),
          hash: new LtHash().digest(),
        }),
      ).rejects.toThrow(/not authorized/)
    })

    it('rejects a member without write access', async () => {
      const space = await sc.createSpace(alice)
      await sc.putMember(alice, space, bob, { read: true, write: false })

      await expect(
        notify(bob, {
          space,
          repo: bob.did,
          repoRev: TID.nextStr(),
          hash: new LtHash().digest(),
        }),
      ).rejects.toThrow(/not authorized/)
    })

    it('rejects a repoRev that is not a TID before any auth check', async () => {
      // `repoRev` is typed as a tid, so a malformed one never reaches the handler.
      // Worth pinning: an adversarial test that passes a junk rev would be
      // rejected here and never exercise the check it means to.
      const space = await sc.createSpace(alice, { members: [bob] })
      await expect(
        notify(bob, {
          space,
          repo: bob.did,
          repoRev: 'not-a-tid',
          hash: new LtHash().digest(),
        }),
      ).rejects.toThrow(/Invalid TID/)
    })
  })
})
