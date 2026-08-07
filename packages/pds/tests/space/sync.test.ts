import { TID } from '@atproto/common'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { parseCid } from '@atproto/lex-data'
import {
  LtHash,
  RepoCommit,
  SignedCommit,
  verifyRepoCarFull,
} from '@atproto/space'
import { NsidString, SpaceRefString } from '@atproto/syntax'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import { com } from '../../src/lexicons/index.js'
import {
  Actor,
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

      const credential = await sc.credentialFor(dan, space)
      const rkeys: string[] = []
      let cursor: string | undefined
      for (let i = 0; i < 10; i++) {
        const page = await dan.client.call(
          com.atproto.space.listRepoOps,
          { space, repo: dan.did, limit: 2, cursor },
          { headers: credential },
        )
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

      const credential = await sc.credentialFor(dan, space)
      const first = await dan.client.call(
        com.atproto.space.listRepoOps,
        { space, repo: dan.did, limit: 1 },
        { headers: credential },
      )
      expect(first.commit).toBeUndefined()
      expect(first.cursor).toBeDefined()

      let cursor = first.cursor
      let commit: unknown
      const seen = [first.ops[0].rev]
      for (let i = 0; i < 5 && cursor; i++) {
        const next = await dan.client.call(
          com.atproto.space.listRepoOps,
          { space, repo: dan.did, cursor, limit: 1 },
          { headers: credential },
        )
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

      const credential = await sc.credentialFor(dan, space)
      const all = await dan.client.call(
        com.atproto.space.listRepoOps,
        { space, repo: dan.did, limit: 100 },
        { headers: credential },
      )
      expect(all.ops).toHaveLength(4)

      // Synced through op 0; page the rest one at a time, holding `since` steady.
      const since = all.ops[0].rev
      const rkeys: string[] = []
      let cursor: string | undefined
      for (let i = 0; i < 10; i++) {
        const page = await dan.client.call(
          com.atproto.space.listRepoOps,
          { space, repo: dan.did, since, cursor, limit: 1 },
          { headers: credential },
        )
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

      const credential = await sc.credentialFor(dan, space)
      const { ops } = await dan.client.call(
        com.atproto.space.listRepoOps,
        { space, repo: dan.did, limit: 100 },
        { headers: credential },
      )
      expect(ops).toHaveLength(2)
      expect(ops[0].value).toBeUndefined()
      expect(ops[1].value).toMatchObject({ text: 'second' })
    })

    it('omits values entirely with excludeValues', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.write(dan, space, { rkey: 'no-value', text: 'body' })

      const credential = await sc.credentialFor(dan, space)
      const { ops } = await dan.client.call(
        com.atproto.space.listRepoOps,
        { space, repo: dan.did, excludeValues: true },
        { headers: credential },
      )
      expect(ops).toHaveLength(1)
      expect(ops[0].value).toBeUndefined()
      // The op still names the record, so a syncer can fetch what it needs.
      expect(ops[0]).toMatchObject({ rkey: 'no-value' })
    })

    it('rejects a malformed cursor', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.write(dan, space, { rkey: 'cursor-check' })
      const credential = await sc.credentialFor(dan, space)

      await expect(
        dan.client.call(
          com.atproto.space.listRepoOps,
          { space, repo: dan.did, cursor: 'not-a-cursor' },
          { headers: credential },
        ),
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

      const credential = await sc.credentialFor(dan, space)
      const { ops, commit } = await dan.client.call(
        com.atproto.space.listRepoOps,
        { space, repo: dan.did, limit: 100 },
        { headers: credential },
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

      const credential = await sc.credentialFor(dan, space)
      const { ops, commit } = await dan.client.call(
        com.atproto.space.listRepoOps,
        { space, repo: dan.did, limit: 100 },
        { headers: credential },
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

      const credential = await sc.credentialFor(bob, space)
      const incremental = await bob.client.call(
        com.atproto.space.listRepoOps,
        { space, repo: bob.did, since: consumerSince, limit: 100 },
        { headers: credential },
      )
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
        const res = await bob.client.call(
          com.atproto.space.listRecords,
          { space, repo: bob.did, limit: 2, cursor },
          { headers: credential },
        )
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
      const latest = await bob.client.call(
        com.atproto.space.getLatestCommit,
        { space, repo: bob.did },
        { headers: credential },
      )
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
      const credHeaders = await sc.credentialFor(carol, space)
      const res = await fetch(
        `${bob.pds.url}/xrpc/com.atproto.space.getRepo?space=${encodeURIComponent(space)}&repo=${bob.did}`,
        { headers: credHeaders },
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

      const credHeaders = await sc.credentialFor(carol, space)
      const res = await fetch(
        `${bob.pds.url}/xrpc/com.atproto.space.getRepo?space=${encodeURIComponent(space)}&repo=${bob.did}&excludeValues=true`,
        { headers: credHeaders },
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
      const res = await fetch(
        `${bob.pds.url}/xrpc/com.atproto.space.getRepo?space=${encodeURIComponent(space)}&repo=${bob.did}`,
        { headers: wrongCred },
      )
      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    it('reports RepoNotFound for an unwritten repo', async () => {
      const space = await sc.createSpace(alice, { members: [carol] })
      const credHeaders = await sc.credentialFor(carol, space)
      await expect(
        alice.client.call(
          com.atproto.space.getLatestCommit,
          { space, repo: alice.did },
          { headers: credHeaders },
        ),
      ).rejects.toMatchObject({ error: 'RepoNotFound' })
    })
  })

  describe('writer set', () => {
    it('records a writer from notifyWrite, and it is not the member list', async () => {
      const space = await sc.createSpace(alice, { members: [bob] })

      // Bob writes on pds2; his PDS fires a best-effort notifyWrite at the
      // authority, which records him in the writer set.
      await sc.write(bob, space, { text: 'writer set entry' })

      const credHeaders = await sc.credentialFor(bob, space)
      const repos = await sc.awaitNotify(
        () =>
          alice.client.call(
            com.atproto.space.listRepos,
            { space },
            { headers: credHeaders },
          ),
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
      expect(entry.rev).toBe(state!.rev)
      expect(entry.hash).toEqual(new LtHash(state!.setHash!).digest())
    })

    it('records a writer admitted by policy public, who was never a member', async () => {
      const space = await sc.createSpace(alice, {
        policy: com.atproto.simplespace.defs.publicPolicy.build({}),
      })
      await sc.write(bob, space, { text: 'from a non-member' })

      await sc.awaitNotify(
        () => sc.writerDids(space),
        (dids) => dids.includes(bob.did),
      )
      await sc.expectWriterSet(space, bob, [bob])
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

  describe('notifyWrite', () => {
    const notify = async (
      signer: Actor,
      body: {
        space: SpaceRefString
        repo: string
        rev: string
        hash: Uint8Array
      },
      opts: { aud?: string } = {},
    ) => {
      const keypair = await signer.pds.ctx.actorStore.keypair(signer.did)
      const { headers } = await createServiceAuthHeaders({
        iss: signer.did,
        aud: opts.aud ?? alice.did,
        lxm: com.atproto.space.notifyWrite.$lxm,
        keypair,
      })
      return alice.client.call(com.atproto.space.notifyWrite, body as never, {
        headers,
      })
    }

    it('rejects one that spoofs the writer', async () => {
      // Bob signs but claims carol wrote. The authority refuses on iss ≠ repo,
      // which is what keeps a PDS from moving another account's sync position.
      const space = await sc.createSpace(alice, { members: [bob, carol] })
      await expect(
        notify(bob, {
          space,
          repo: carol.did,
          rev: TID.nextStr(),
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
            rev: state!.rev!,
            hash: new LtHash(state!.setHash!).digest(),
          },
          { aud: carol.did },
        ),
      ).rejects.toThrow(/aud does not match the space authority/)
    })

    it('rejects one from a non-member', async () => {
      // iss === repo, but the signer isn't admitted by the space's policy.
      const space = await sc.createSpace(alice, { members: [bob] })
      await expect(
        notify(carol, {
          space,
          repo: carol.did,
          rev: TID.nextStr(),
          hash: new LtHash().digest(),
        }),
      ).rejects.toThrow(/not authorized/)
    })

    it('rejects a rev that is not a TID before any auth check', async () => {
      // `rev` is typed as a tid, so a malformed one never reaches the handler.
      // Worth pinning: an adversarial test that passes a junk rev would be
      // rejected here and never exercise the check it means to.
      const space = await sc.createSpace(alice, { members: [bob] })
      await expect(
        notify(bob, {
          space,
          repo: bob.did,
          rev: 'not-a-tid',
          hash: new LtHash().digest(),
        }),
      ).rejects.toThrow(/Invalid TID/)
    })
  })
})
