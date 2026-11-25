import { TID } from '@atproto/common'
import type { TestNetworkNoAppView } from '@atproto/dev-env'
import { getBlobCidString } from '@atproto/lex-data'
import {
  type DidString,
  type NsidString,
  type RecordKeyString,
  SpaceRef,
  type SpaceRefString,
  isValidTid,
} from '@atproto/syntax'
import { com } from '../../src/lexicons/index.js'
import {
  type Actor,
  MockService,
  type SpaceClient,
  TEST_COLLECTION,
  TEST_SPACE_TYPE,
  createSpaceNetwork,
} from '../_space.js'

const { personalspace, memberspace, managedspace } = com.atproto
const POLICY = com.atproto.space.policy.$type
const MEMBER = memberspace.member.$type
const OTHER_SPACE_TYPE = 'com.example.otherGroup' as NsidString

describe('space policy', () => {
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

  const getSpace = (space: SpaceRefString) =>
    alice.client.call(
      com.atproto.space.getSpace,
      { space },
      { headers: alice.headers },
    )

  const updateSpace = (
    space: SpaceRefString,
    policy: com.atproto.space.updateSpace.$InputBody['policy'],
  ) =>
    alice.client.call(
      com.atproto.space.updateSpace,
      { space, policy },
      { headers: alice.headers },
    )

  const deleteSpace = (space: SpaceRefString) =>
    alice.client.call(
      com.atproto.space.deleteSpace,
      { space },
      { headers: alice.headers },
    )

  const listMembers = async (space: SpaceRefString) => {
    const { members } = await alice.client.call(
      com.atproto.memberspace.listMembers,
      { space },
      { headers: alice.headers },
    )
    return members
  }

  const listSpaces = async (
    actor: Actor,
    filter: { spaceType?: NsidString; spaceDid?: DidString } = {},
  ) => {
    const { spaces } = await actor.client.call(
      com.atproto.space.listSpaces,
      filter,
      { headers: actor.headers },
    )
    return spaces
  }

  const listRecords = async (
    actor: Actor,
    space: SpaceRefString,
    collection?: NsidString,
  ) => {
    const { records } = await actor.client.call(
      com.atproto.space.listRecords,
      { space, repo: actor.did, collection },
      { headers: actor.headers },
    )
    return records
  }

  describe('createSpace and listSpaces', () => {
    it('creates a space under the caller DID, keyed by a TID by default', async () => {
      const { space } = await alice.client.call(
        com.atproto.space.createSpace,
        { spaceType: TEST_SPACE_TYPE, policy: memberspace.policy.$build({}) },
        { headers: alice.headers },
      )

      const ref = SpaceRef.parse(space)
      expect(ref.spaceDid).toBe(alice.did)
      expect(ref.spaceType).toBe(TEST_SPACE_TYPE)
      expect(isValidTid(ref.skey)).toBe(true)
      expect((await listSpaces(alice)).map((s) => s.space)).toContain(space)
    })

    it('refuses a duplicate space', async () => {
      const skey = TID.nextStr()
      await sc.createSpace(alice, { skey })
      await expect(sc.createSpace(alice, { skey })).rejects.toMatchObject({
        error: 'SpaceAlreadyExists',
      })
    })

    it('filters spaces by spaceType', async () => {
      const space = await sc.createSpace(alice)
      const other = await sc.createSpace(alice, { spaceType: OTHER_SPACE_TYPE })

      const listed = async (spaceType: NsidString) =>
        (await listSpaces(alice, { spaceType })).map((s) => s.space)
      expect(await listed(TEST_SPACE_TYPE)).toContain(space)
      expect(await listed(TEST_SPACE_TYPE)).not.toContain(other)
      expect(await listed(OTHER_SPACE_TYPE)).toEqual([other])
    })

    it("lists the state of the caller's repo in each space", async () => {
      const space = await sc.createSpace(alice, { members: [bob] })
      const empty = await sc.createSpace(alice)
      await sc.write(alice, space)
      await sc.write(bob, space)

      const viewOf = async (actor: Actor, target: SpaceRefString) => {
        const spaces = await listSpaces(actor, { spaceDid: alice.did })
        return spaces.find((s) => s.space === target)
      }
      const commitOf = async (actor: Actor) => {
        const commit = await sc.latestCommit(actor, space)
        return { repoRev: commit!.rev, data: commit!.data }
      }

      // Only the authority sequences the space, so only it has a space revision.
      const { spaceRev } = await sc.credentialFor(alice, space)
      expect(await viewOf(alice, space)).toEqual({
        space,
        ...(await commitOf(alice)),
        spaceRev,
      })
      expect(await viewOf(bob, space)).toEqual({
        space,
        ...(await commitOf(bob)),
      })
      expect(await viewOf(alice, empty)).toEqual({ space: empty })
    })
  })

  describe('authority', () => {
    it('refuses management methods to an account other than the authority', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      const opts = { headers: dan.headers }
      const calls = [
        () => dan.client.call(com.atproto.space.getSpace, { space }, opts),
        () =>
          dan.client.call(
            com.atproto.space.updateSpace,
            { space, policy: memberspace.policy.$build({ publicRead: true }) },
            opts,
          ),
        () => dan.client.call(com.atproto.space.deleteSpace, { space }, opts),
        () =>
          dan.client.call(com.atproto.memberspace.listMembers, { space }, opts),
        () => sc.putMember(dan, space, carol),
        () => sc.removeMember(dan, space, dan),
      ]
      for (const call of calls) {
        await expect(call()).rejects.toMatchObject({ error: 'NotAuthorized' })
      }
    })

    it('keeps the policy and member list from a space credential', async () => {
      const space = await sc.createSpace(alice, { members: [carol] })
      const client = (await sc.credentialFor(carol, space)).clientFor(alice.pds)

      const refused = {
        error: 'InvalidToken',
        message: 'Unexpected authorization type',
      }
      await expect(
        client.call(com.atproto.space.getSpace, { space }),
      ).rejects.toMatchObject(refused)
      await expect(
        client.call(com.atproto.memberspace.listMembers, { space }),
      ).rejects.toMatchObject(refused)
    })
  })

  describe('policy', () => {
    it('stores the policy normalized, with defaults filled in', async () => {
      const managingApp = 'did:web:example.com#forum'
      const managed = await sc.createSpace(alice, {
        policy: managedspace.policy.$build({ managingApp }),
      })
      expect(await getSpace(managed)).toEqual({
        space: managed,
        policy: managedspace.policy.$build({
          managingApp,
          publishPolicy: false,
        }),
      })

      const member = await sc.createSpace(alice, {
        policy: memberspace.policy.$build({}),
      })
      expect((await getSpace(member)).policy).toEqual(
        memberspace.policy.$build({
          publicRead: false,
          publicWrite: false,
          publishPolicy: false,
          publishMembers: false,
        }),
      )
    })

    it('replaces the policy wholesale on update', async () => {
      const space = await sc.createSpace(alice, {
        policy: memberspace.policy.$build({
          publicRead: true,
          allowedApps: ['https://app.example.com/client-metadata.json'],
          publishMembers: true,
        }),
      })

      await updateSpace(space, memberspace.policy.$build({ publicWrite: true }))

      expect((await getSpace(space)).policy).toEqual(
        memberspace.policy.$build({
          publicRead: false,
          publicWrite: true,
          publishPolicy: false,
          publishMembers: false,
        }),
      )
    })

    it('keeps the member list across a configuration change', async () => {
      const space = await sc.createSpace(alice, { members: [bob] })
      await updateSpace(space, memberspace.policy.$build({ publicRead: true }))

      expect(await listMembers(space)).toEqual([
        { did: bob.did, read: true, write: true },
      ])
    })

    it('discards the member list and its published records on migration', async () => {
      const space = await sc.createSpace(alice, {
        policy: memberspace.policy.$build({ publishMembers: true }),
        members: [bob],
      })

      await updateSpace(space, personalspace.policy.$build({}))
      expect(await listRecords(alice, space, MEMBER)).toEqual([])

      // Migrating back does not restore it.
      await updateSpace(space, memberspace.policy.$build({}))
      expect(await listMembers(space)).toEqual([])
      await expect(sc.credentialFor(bob, space)).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
    })

    it('refuses an unrecognized policy', async () => {
      const space = await sc.createSpace(alice)
      await expect(
        updateSpace(space, { $type: 'com.example.whatever' } as never),
      ).rejects.toMatchObject({ error: 'UnsupportedPolicy' })
    })

    it('refuses a managingApp that is not a did#serviceId reference', async () => {
      const space = await sc.createSpace(alice)
      await expect(
        updateSpace(
          space,
          managedspace.policy.$build({ managingApp: 'did:web:example.com' }),
        ),
      ).rejects.toMatchObject({
        error: 'InvalidRequest',
        message:
          'managingApp must be a did#serviceId reference, got: did:web:example.com',
      })
    })
  })

  describe('memberspace members', () => {
    const byDid = <T extends { did: string }>(members: T[]) =>
      members.toSorted((a, b) => a.did.localeCompare(b.did))

    it('puts and removes members', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.putMember(alice, space, bob, { read: true, write: false })
      expect(await listMembers(space)).toEqual(
        byDid([
          { did: dan.did, read: true, write: true },
          { did: bob.did, read: true, write: false },
        ]),
      )

      await sc.removeMember(alice, space, bob)
      expect(await listMembers(space)).toEqual([
        { did: dan.did, read: true, write: true },
      ])
    })

    it('replaces both access values on put', async () => {
      const space = await sc.createSpace(alice)
      await sc.putMember(alice, space, bob, { read: true, write: false })
      await sc.putMember(alice, space, bob, { read: false, write: true })

      expect(await listMembers(space)).toEqual([
        { did: bob.did, read: false, write: true },
      ])
    })

    it('takes the last entry for a member listed twice', async () => {
      const space = await sc.createSpace(alice, {
        policy: memberspace.policy.$build({ publishMembers: true }),
      })
      await alice.client.call(
        com.atproto.memberspace.putMembers,
        {
          space,
          members: [
            { did: bob.did, read: true, write: true },
            { did: bob.did, read: true, write: false },
          ],
        },
        { headers: alice.headers },
      )
      expect(await listMembers(space)).toEqual([
        { did: bob.did, read: true, write: false },
      ])
    })

    it('applies a batch of member changes in a single commit', async () => {
      const space = await sc.createSpace(alice, {
        policy: memberspace.policy.$build({ publishMembers: true }),
      })
      const memberOps = async () => {
        const { ops } = await alice.client.call(
          com.atproto.space.listRepoOps,
          { space, repo: alice.did },
          { headers: alice.headers },
        )
        return ops.filter((op) => op.collection === MEMBER)
      }

      await alice.client.call(
        com.atproto.memberspace.putMembers,
        {
          space,
          members: [
            { did: bob.did, read: true, write: true },
            { did: carol.did, read: true, write: false },
          ],
        },
        { headers: alice.headers },
      )
      const added = await memberOps()
      expect(added).toHaveLength(2)
      expect(added[0].rev).toBe(added[1].rev)

      await alice.client.call(
        com.atproto.memberspace.removeMembers,
        { space, dids: [bob.did, carol.did] },
        { headers: alice.headers },
      )
      const removed = (await memberOps()).filter((op) => op.cid === null)
      expect(removed).toHaveLength(2)
      expect(removed[0].rev).toBe(removed[1].rev)
      expect(await listMembers(space)).toEqual([])
    })

    it('refuses member methods on a space under another policy', async () => {
      const space = await sc.createSpace(alice, {
        policy: personalspace.policy.$build({}),
      })
      await expect(sc.putMember(alice, space, bob)).rejects.toMatchObject({
        error: 'PolicyMismatch',
      })
      await expect(sc.removeMember(alice, space, bob)).rejects.toMatchObject({
        error: 'PolicyMismatch',
      })
      await expect(listMembers(space)).rejects.toMatchObject({
        error: 'PolicyMismatch',
      })
    })

    it('drops removed members and revoked writers from the writer set, and tells syncers', async () => {
      await using syncer = await MockService.create(network, {
        serviceId: 'atproto_space_syncer',
      })
      const space = await sc.createSpace(alice, { members: [dan, bob] })
      await sc.credentialFor(alice, space, {
        notify: syncer.notifyRegistration(),
      })
      await sc.write(dan, space)
      await sc.write(bob, space)

      await sc.putMember(alice, space, dan, { read: true, write: true })
      expect(await sc.writers(space, alice)).toEqual([dan.did, bob.did].sort())

      await sc.putMember(alice, space, dan, { read: true, write: false })
      await sc.removeMember(alice, space, bob)
      expect(await sc.writers(space, alice)).toEqual([])

      await network.pds.ctx.backgroundQueue.processAll()
      const removed = syncer
        .spaceUpdates()
        .filter((update) =>
          com.atproto.space.defs.repoRemoved.$isTypeOf(update),
        )
      expect(removed.map((update) => update.repo).sort()).toEqual(
        [dan.did, bob.did].sort(),
      )
    })

    it('ignores a DID that is not a member, leaving it in the writer set', async () => {
      const space = await sc.createSpace(alice, {
        policy: memberspace.policy.$build({ publicWrite: true }),
      })
      await sc.write(dan, space)

      await sc.removeMember(alice, space, dan)
      expect(await sc.writers(space, alice)).toEqual([dan.did])
    })
  })

  describe('publishing to readers', () => {
    const publishedMembers = async (space: SpaceRefString) => {
      const records = await listRecords(alice, space, MEMBER)
      return records
        .map((r) => ({ did: r.rkey, value: r.value }))
        .sort((a, b) => a.did.localeCompare(b.did))
    }

    it('publishes the policy to readers', async () => {
      const space = await sc.createSpace(alice, {
        policy: memberspace.policy.$build({ publishPolicy: true }),
        members: [carol],
      })
      const { policy } = await getSpace(space)

      const cred = await sc.credentialFor(carol, space)
      const { records } = await cred
        .clientFor(alice.pds)
        .call(com.atproto.space.listRecords, {
          space,
          repo: alice.did,
          collection: POLICY,
        })
      expect(records).toMatchObject([
        { rkey: 'self', value: { $type: POLICY, policy } },
      ])
    })

    it('keeps the published policy in sync, and withdraws it when unpublished', async () => {
      const space = await sc.createSpace(alice, {
        policy: managedspace.policy.$build({
          managingApp: 'did:web:example.com#forum',
          publishPolicy: true,
        }),
      })

      await updateSpace(
        space,
        memberspace.policy.$build({ publicRead: true, publishPolicy: true }),
      )
      const { policy } = await getSpace(space)
      expect(await listRecords(alice, space, POLICY)).toMatchObject([
        { value: com.atproto.space.policy.$build({ policy }) },
      ])

      await updateSpace(space, memberspace.policy.$build({}))
      expect(await listRecords(alice, space, POLICY)).toEqual([])
    })

    it('publishes the member list, keyed by member DID', async () => {
      const space = await sc.createSpace(alice, {
        policy: memberspace.policy.$build({ publishMembers: true }),
      })
      await sc.putMember(alice, space, bob)
      await sc.putMember(alice, space, carol)
      await sc.putMember(alice, space, carol, { read: true, write: false })
      await sc.removeMember(alice, space, bob)

      expect(await publishedMembers(space)).toEqual([
        {
          did: carol.did,
          value: memberspace.member.$build({ read: true, write: false }),
        },
      ])
    })

    it('publishes or withdraws the whole member list when publishMembers changes', async () => {
      const space = await sc.createSpace(alice, { members: [bob, carol] })
      expect(await publishedMembers(space)).toEqual([])

      await updateSpace(
        space,
        memberspace.policy.$build({ publishMembers: true }),
      )
      expect((await publishedMembers(space)).map((m) => m.did)).toEqual(
        [bob.did, carol.did].sort(),
      )

      await updateSpace(space, memberspace.policy.$build({}))
      expect(await publishedMembers(space)).toEqual([])
    })

    it('keeps the published records when the authority clears its repo', async () => {
      const space = await sc.createSpace(alice, {
        policy: memberspace.policy.$build({
          publishPolicy: true,
          publishMembers: true,
        }),
        members: [bob],
      })
      await sc.write(alice, space)

      await sc.clear(alice, space)
      const records = await listRecords(alice, space)
      expect(records.map((r) => r.collection).sort()).toEqual(
        [MEMBER, POLICY].sort(),
      )
      await sc.expectCommitMatchesRecords(alice, space)

      // With only the published records left, there is nothing more to clear.
      const cleared = await sc.latestCommit(alice, space)
      await sc.clear(alice, space)
      expect(await sc.latestCommit(alice, space)).toEqual(cleared)
    })

    it('records the authority as a writer when it publishes', async () => {
      const space = await sc.createSpace(alice, {
        policy: memberspace.policy.$build({ publishPolicy: true }),
      })
      expect(await sc.writers(space, alice)).toEqual([alice.did])
    })

    const policyRecord = com.atproto.space.policy.$build({
      policy: personalspace.policy.$build({}),
    })
    const self = 'self' as RecordKeyString

    it.each([
      {
        method: 'createRecord',
        write: (space: SpaceRefString) =>
          sc.write(alice, space, {
            collection: POLICY,
            rkey: self,
            record: policyRecord,
          }),
      },
      {
        method: 'putRecord',
        write: (space: SpaceRefString) =>
          sc.put(alice, space, {
            collection: POLICY,
            rkey: self,
            record: policyRecord,
          }),
      },
      {
        method: 'deleteRecord',
        write: (space: SpaceRefString) =>
          sc.del(alice, space, { collection: POLICY, rkey: self }),
      },
      {
        method: 'applyWrites',
        write: (space: SpaceRefString) =>
          alice.client.call(
            com.atproto.space.applyWrites,
            {
              space,
              repo: alice.did,
              writes: [
                com.atproto.space.applyWrites.create.$build({
                  collection: POLICY,
                  rkey: self,
                  value: policyRecord,
                }),
              ],
            },
            { headers: alice.headers },
          ),
      },
    ])('refuses a direct $method of a published record', async ({ write }) => {
      const space = await sc.createSpace(alice, {
        policy: memberspace.policy.$build({ publishPolicy: true }),
      })
      await expect(write(space)).rejects.toMatchObject({
        error: 'InvalidRequest',
        message: expect.stringContaining('cannot be written directly'),
      })
    })
  })

  describe('deleteSpace', () => {
    it("purges the authority's repo and its blobs", async () => {
      const space = await sc.createSpace(alice)
      const { body } = await alice.client.uploadBlob(
        Buffer.from('space blob'),
        { headers: alice.headers, encoding: 'application/octet-stream' },
      )
      const cid = getBlobCidString(body.blob)
      await sc.write(alice, space, {
        record: { $type: TEST_COLLECTION, text: 'hi', image: body.blob },
      })
      expect(await sc.blobExists(alice, cid)).toBe(true)

      await deleteSpace(space)

      await expect(getSpace(space)).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
      expect(await listRecords(alice, space)).toEqual([])
      expect(await sc.latestCommit(alice, space)).toBeNull()
      expect(await sc.blobExists(alice, cid)).toBe(false)
    })

    it('answers SpaceDeleted to any authorization request', async () => {
      const space = await sc.createSpace(alice)
      await deleteSpace(space)

      await expect(sc.authorize(space)).rejects.toMatchObject({
        error: 'SpaceDeleted',
      })
      await expect(
        sc.authorize(space, { delegationToken: 'not-a-delegation-token' }),
      ).rejects.toMatchObject({ error: 'SpaceDeleted' })
    })

    it('accepts a repeated delete', async () => {
      const space = await sc.createSpace(alice)
      await deleteSpace(space)
      await expect(deleteSpace(space)).resolves.toBeUndefined()
    })

    it('refuses a space that was never created', async () => {
      const space = await sc.createSpace(alice, { ungoverned: true })
      await expect(deleteSpace(space)).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
    })

    it('leaves a member repo untouched', async () => {
      const space = await sc.createSpace(alice, { members: [bob] })
      await sc.write(bob, space, { text: 'member write' })

      await deleteSpace(space)

      expect(await listRecords(bob, space)).toMatchObject([
        { value: { text: 'member write' } },
      ])
    })

    it('re-creates a deleted space from scratch', async () => {
      const skey = TID.nextStr()
      const space = await sc.createSpace(alice, {
        skey,
        policy: memberspace.policy.$build({
          publicRead: true,
          publicWrite: true,
        }),
        members: [bob],
      })
      await sc.write(alice, space)
      await deleteSpace(space)

      expect(await sc.createSpace(alice, { skey })).toBe(space)
      expect((await getSpace(space)).policy).toEqual(
        memberspace.policy.$build({
          publicRead: false,
          publicWrite: false,
          publishPolicy: false,
          publishMembers: false,
        }),
      )
      expect(await listMembers(space)).toEqual([])
      expect(await sc.writers(space, alice)).toEqual([])
      await expect(sc.write(alice, space)).resolves.toMatchObject({
        uri: expect.any(String),
      })
    })
  })
})
