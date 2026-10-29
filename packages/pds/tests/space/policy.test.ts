import { TestNetworkNoAppView } from '@atproto/dev-env'
import type { NsidString } from '@atproto/lex'
import { getBlobCidString } from '@atproto/lex-data'
import { JoseKey } from '@atproto/oauth-provider/provider'
import { spaceHostAud } from '@atproto/space'
import type { DidString, SpaceRefString } from '@atproto/syntax'
import { com } from '../../src/lexicons/index.js'
import {
  type Actor,
  MockClientApp,
  MockService,
  SpaceClient,
  TEST_COLLECTION,
  TEST_SPACE_TYPE,
} from '../_space.js'

const { personalspace, memberspace, managedspace } = com.atproto

/**
 * Space policies: the `com.atproto.space` lifecycle methods, and the baseline
 * policies every PDS supports (`personalspace`, `memberspace`, `managedspace`).
 *
 * The protocol side only ever asks the authority "may this user read?"; every
 * decision behind that question lives in the space's policy.
 */
describe('space policy', () => {
  let network: TestNetworkNoAppView
  let sc: SpaceClient
  let alice: Actor // authority / owner
  let dan: Actor // co-located with the authority
  let bob: Actor // on pds2
  let carol: Actor // on pds3

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'space_policy',
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

  const listMembers = (space: SpaceRefString) =>
    alice.client.call(
      com.atproto.memberspace.listMembers,
      { space },
      { headers: alice.headers },
    )

  describe('lifecycle', () => {
    it('creates a space anchored on the caller own DID', async () => {
      // There is no `did` param: a space is always under the caller's authority,
      // so there is no way to ask for one under someone else's.
      const space = await sc.createSpace(alice)
      expect(space.startsWith(`at://${alice.did}/space/`)).toBe(true)

      const listed = await alice.client.call(
        com.atproto.space.listSpaces,
        {},
        { headers: alice.headers },
      )
      expect(listed.spaces.map((s) => s.uri)).toContain(space)
    })

    it('refuses a duplicate space', async () => {
      const space = await sc.createSpace(alice)
      await expect(
        alice.client.call(
          com.atproto.space.createSpace,
          {
            spaceType: TEST_SPACE_TYPE,
            skey: space.split('/').pop()!,
            policy: memberspace.policy.$build({}),
          },
          { headers: alice.headers },
        ),
      ).rejects.toMatchObject({ error: 'SpaceAlreadyExists' })
    })

    it('refuses a space key that is not a valid record key', async () => {
      await expect(
        alice.client.call(
          com.atproto.space.createSpace,
          {
            spaceType: TEST_SPACE_TYPE,
            skey: 'not a valid rkey',
            policy: memberspace.policy.$build({}),
          },
          { headers: alice.headers },
        ),
      ).rejects.toThrow(/record key/i)
    })

    it('filters spaces by spaceType', async () => {
      const space = await sc.createSpace(alice)
      const otherType = 'com.example.otherGroup' as NsidString
      const other = await sc.createSpace(alice, { spaceType: otherType })

      const listed = await alice.client.call(
        com.atproto.space.listSpaces,
        { spaceType: TEST_SPACE_TYPE },
        { headers: alice.headers },
      )
      expect(listed.spaces.map((s) => s.uri)).toContain(space)
      expect(listed.spaces.map((s) => s.uri)).not.toContain(other)

      const otherListed = await alice.client.call(
        com.atproto.space.listSpaces,
        { spaceType: otherType },
        { headers: alice.headers },
      )
      expect(otherListed.spaces.map((s) => s.uri)).toEqual([other])
    })

    it('refuses an owner write until createSpace', async () => {
      // A write to another authority's space creates the repo unchecked, but the
      // owner's own space must exist first: a write never conjures one.
      const skey = 'lazy'
      const space =
        `at://${alice.did}/space/${TEST_SPACE_TYPE}/${skey}` as SpaceRefString
      await expect(
        sc.write(alice, space, { text: 'too early' }),
      ).rejects.toMatchObject({ error: 'SpaceNotFound' })

      await sc.createSpace(alice, { skey })
      await sc.write(alice, space, { text: 'lazy space' })

      const listed = await alice.client.call(
        com.atproto.space.listRecords,
        { space, repo: alice.did },
        { headers: alice.headers },
      )
      expect(listed.records).toHaveLength(1)
    })
  })

  describe('memberspace members', () => {
    it('adds and removes members, and the owner is not one of them', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.putMember(alice, space, bob, { read: true, write: false })

      const members = await listMembers(space)
      const dids = members.members.map((m) => m.did)
      // Alice is the authority, which is checked against the space uri rather
      // than carried on the member list.
      expect(dids).not.toContain(alice.did)
      expect(dids).toContain(dan.did)
      expect(dids).toContain(bob.did)
      expect(members.members.find((m) => m.did === bob.did)).toMatchObject({
        read: true,
        write: false,
      })

      await sc.removeMember(alice, space, bob)
      const after = await listMembers(space)
      expect(after.members.map((m) => m.did)).not.toContain(bob.did)
    })

    it('refuses membership changes from a non-owner member', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await expect(
        dan.client.call(
          com.atproto.memberspace.putMember,
          { space, did: carol.did, read: true, write: true },
          { headers: dan.headers },
        ),
      ).rejects.toMatchObject({ error: 'NotSpaceOwner' })
      await expect(
        dan.client.call(
          com.atproto.memberspace.removeMember,
          { space, did: dan.did },
          { headers: dan.headers },
        ),
      ).rejects.toMatchObject({ error: 'NotSpaceOwner' })
    })

    it('refuses listMembers to a space credential and to a non-owner member', async () => {
      const space = await sc.createSpace(alice, { members: [carol, dan] })

      // Carol is a member, hosted elsewhere: a credential reads the space's data,
      // but the member list is the authority's own.
      const cred = await sc.credentialFor(carol, space)
      await expect(
        cred
          .clientFor(alice.pds)
          .call(com.atproto.memberspace.listMembers, { space }),
      ).rejects.toThrow()

      // Dan is co-located with the authority, but the space is not his.
      await expect(
        alice.client.call(
          com.atproto.memberspace.listMembers,
          { space },
          { headers: dan.headers },
        ),
      ).rejects.toMatchObject({ error: 'NotSpaceOwner' })
    })

    it('putMember replaces both access values', async () => {
      const space = await sc.createSpace(alice)
      await sc.putMember(alice, space, bob, { read: true, write: false })
      await sc.putMember(alice, space, bob, { read: false, write: true })

      const members = await listMembers(space)
      expect(members.members.filter((m) => m.did === bob.did)).toHaveLength(1)
      expect(members.members[0]).toMatchObject({
        did: bob.did,
        read: false,
        write: true,
      })
    })

    it('refuses member methods on a space under another policy', async () => {
      // The member list belongs to memberspace: no other policy consults one.
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
  })

  describe('policy', () => {
    it('persists what createSpace was given', async () => {
      const space = await sc.createSpace(alice, {
        policy: managedspace.policy.$build({
          managingApp: 'did:web:example.com#forum',
          allowedApps: ['app:one', 'app:two'],
        }),
      })

      const got = await getSpace(space)
      expect(got.uri).toBe(space)
      expect(got.policy).toEqual({
        $type: 'com.atproto.managedspace.policy',
        managingApp: 'did:web:example.com#forum',
        allowedApps: ['app:one', 'app:two'],
        publishPolicy: false,
      })
    })

    it('fills in the defaults of an omitted configuration', async () => {
      const space = await sc.createSpace(alice, {
        policy: memberspace.policy.$build({}),
      })
      const got = await getSpace(space)
      expect(got.policy).toEqual({
        $type: 'com.atproto.memberspace.policy',
        publicRead: false,
        publicWrite: false,
        publishPolicy: false,
        publishMembers: false,
      })
    })

    it('replaces the policy wholesale on update', async () => {
      const space = await sc.createSpace(alice, {
        policy: memberspace.policy.$build({
          publicRead: true,
          allowedApps: ['app:x'],
          publishMembers: true,
        }),
      })

      await updateSpace(space, memberspace.policy.$build({ publicWrite: true }))

      // Nothing from the previous configuration is merged into the new one.
      const got = await getSpace(space)
      expect(got.policy).toEqual({
        $type: 'com.atproto.memberspace.policy',
        publicRead: false,
        publicWrite: true,
        publishPolicy: false,
        publishMembers: false,
      })
    })

    it('keeps the member list across a configuration change', async () => {
      // The member list is not part of the policy object, so a change that keeps
      // the policy's $type leaves it alone.
      const space = await sc.createSpace(alice, { members: [bob] })
      await updateSpace(space, memberspace.policy.$build({ publicRead: true }))

      const members = await listMembers(space)
      expect(members.members.map((m) => m.did)).toEqual([bob.did])
    })

    it('refuses an update from a non-owner', async () => {
      const space = await sc.createSpace(alice, { members: [bob] })
      await expect(
        alice.client.call(
          com.atproto.space.updateSpace,
          {
            space,
            policy: memberspace.policy.$build({ publicRead: true }),
          },
          { headers: bob.headers },
        ),
      ).rejects.toThrow()
    })

    it('refuses an unrecognized policy', async () => {
      const space = await sc.createSpace(alice)
      await expect(
        updateSpace(space, { $type: 'com.example.whatever' } as never),
      ).rejects.toMatchObject({ error: 'UnsupportedPolicy' })
    })

    it('refuses a managingApp that does not name a service', async () => {
      const space = await sc.createSpace(alice)
      await expect(
        updateSpace(
          space,
          managedspace.policy.$build({ managingApp: 'not-a-did-at-all' }),
        ),
      ).rejects.toThrow(/must be a DID/)
    })

    it('refuses the policy to a member with a space credential', async () => {
      // The policy is the authority's own state. Readers see it only if the
      // policy is published.
      const space = await sc.createSpace(alice, { members: [carol] })
      const cred = await sc.credentialFor(carol, space)

      await expect(
        cred.clientFor(alice.pds).call(com.atproto.space.getSpace, { space }),
      ).rejects.toThrow()
    })

    it('refuses the policy to another account on an account credential', async () => {
      // Dan is a member and is hosted here, but an account credential reaches the
      // policy only for that account's own spaces.
      const space = await sc.createSpace(alice, { members: [dan] })

      await expect(
        dan.client.call(
          com.atproto.space.getSpace,
          { space },
          { headers: dan.headers },
        ),
      ).rejects.toMatchObject({ error: 'NotSpaceOwner' })
    })

    it('refuses to answer for a space this host does not govern', async () => {
      // pds2 hosts no account for alice, so it holds no policy to answer from.
      const space = await sc.createSpace(alice, { members: [bob] })
      const cred = await sc.credentialFor(bob, space)

      // The error names the space rather than leaking it as a missing repo.
      await expect(
        cred.clientFor(bob.pds).call(com.atproto.space.listRepos, { space }),
      ).rejects.toMatchObject({ error: 'SpaceNotFound' })
      await expect(
        bob.client.call(
          com.atproto.space.getSpace,
          { space },
          { headers: bob.headers },
        ),
      ).rejects.toThrow()
    })
  })

  describe('policy migration', () => {
    it('discards the member list, and migrating back does not restore it', async () => {
      const space = await sc.createSpace(alice, { members: [bob, carol] })

      await updateSpace(space, personalspace.policy.$build({}))
      await updateSpace(space, memberspace.policy.$build({}))

      const members = await listMembers(space)
      expect(members.members).toEqual([])
      // Bob's membership went with the list.
      const token = await sc.delegationTokenFor(bob, space)
      await expect(sc.mintCredential(space, token)).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
    })
  })

  /**
   * A policy can publish the space's policy and member list to readers, as
   * records in the authority's own repo in the space. The policy and member list
   * stay the source of truth, and the PDS keeps the records in sync with them.
   */
  describe('publishing to readers', () => {
    const POLICY = 'com.atproto.space.policy' as NsidString
    const MEMBER = 'com.atproto.memberspace.member' as NsidString

    const published = async (space: SpaceRefString, collection: NsidString) => {
      const res = await alice.client.call(
        com.atproto.space.listRecords,
        { space, repo: alice.did, collection },
        { headers: alice.headers },
      )
      return res.records
    }

    const publishedMembers = async (space: SpaceRefString) => {
      const records = await published(space, MEMBER)
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

      // Carol reads it with a space credential, like any other record.
      const cred = await sc.credentialFor(carol, space)
      const res = await cred
        .clientFor(alice.pds)
        .call(com.atproto.space.listRecords, {
          space,
          repo: alice.did,
          collection: POLICY,
        })
      expect(res.records).toHaveLength(1)
      expect(res.records[0].rkey).toBe('self')
      expect(res.records[0].value).toEqual({ $type: POLICY, policy })
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
        memberspace.policy.$build({
          publicRead: true,
          publishPolicy: true,
        }),
      )
      const [record] = await published(space, POLICY)
      expect(record.value).toEqual({
        $type: POLICY,
        policy: (await getSpace(space)).policy,
      })

      await updateSpace(space, memberspace.policy.$build({}))
      expect(await published(space, POLICY)).toEqual([])
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
        { did: carol.did, value: { $type: MEMBER, read: true, write: false } },
      ])
    })

    it('leaves the port of a localhost did:web unencoded in its record key', async () => {
      // A record key can't contain `%`.
      const space = await sc.createSpace(alice, {
        policy: memberspace.policy.$build({ publishMembers: true }),
      })
      const did = 'did:web:localhost%3A2583' as DidString
      const member = { space, did, read: true, write: true }
      await alice.client.call(com.atproto.memberspace.putMember, member, {
        headers: alice.headers,
      })
      expect(await publishedMembers(space)).toMatchObject([
        { did: 'did:web:localhost:2583' },
      ])

      await alice.client.call(
        com.atproto.memberspace.removeMember,
        { space, did },
        { headers: alice.headers },
      )
      expect(await publishedMembers(space)).toEqual([])
    })

    it('publishes or withdraws the whole member list when publishMembers changes', async () => {
      const space = await sc.createSpace(alice, { members: [bob, carol] })
      expect(await publishedMembers(space)).toEqual([])

      await updateSpace(
        space,
        memberspace.policy.$build({ publishMembers: true }),
      )
      const dids = (await publishedMembers(space)).map((m) => m.did)
      expect(dids).toEqual([bob.did, carol.did].sort())

      await updateSpace(space, memberspace.policy.$build({}))
      expect(await publishedMembers(space)).toEqual([])
    })

    it('withdraws the published member list on migration', async () => {
      const space = await sc.createSpace(alice, {
        policy: memberspace.policy.$build({ publishMembers: true }),
        members: [bob],
      })
      await updateSpace(space, personalspace.policy.$build({}))
      expect(await publishedMembers(space)).toEqual([])
    })

    it('notifies the space of what it publishes', async () => {
      // A published record is a write to the authority's repo, so syncers
      // discover it the same way as any other.
      const space = await sc.createSpace(alice, {
        policy: memberspace.policy.$build({ publishPolicy: true }),
      })
      const dids = await sc.awaitNotify(
        () => sc.writerDids(space),
        (all) => all.includes(alice.did),
      )
      expect(dids).toEqual([alice.did])
    })

    it('refuses direct writes of published records', async () => {
      const space = await sc.createSpace(alice, {
        policy: memberspace.policy.$build({ publishPolicy: true }),
        members: [bob],
      })
      const record = {
        $type: POLICY,
        policy: { $type: 'com.atproto.personalspace.policy' },
      }
      const refused = /cannot be written directly/

      // In any repo, not only the authority's.
      await expect(
        sc.put(alice, space, { collection: POLICY, rkey: 'self', record }),
      ).rejects.toThrow(refused)
      await expect(
        sc.write(bob, space, {
          collection: MEMBER,
          rkey: carol.did,
          record: { $type: MEMBER, read: true, write: true },
        }),
      ).rejects.toThrow(refused)
      await expect(
        bob.client.call(
          com.atproto.space.applyWrites,
          {
            space,
            repo: bob.did,
            writes: [
              {
                $type: 'com.atproto.space.applyWrites#create',
                collection: POLICY,
                rkey: 'self',
                value: record,
              },
            ],
          },
          { headers: bob.headers },
        ),
      ).rejects.toThrow(refused)

      // Turning validation off doesn't open a way around it.
      await expect(
        sc.put(alice, space, {
          collection: POLICY,
          rkey: 'self',
          record,
          validate: false,
        }),
      ).rejects.toThrow(refused)

      // Nor can the published policy be withdrawn other than by the policy.
      await expect(
        sc.del(alice, space, { collection: POLICY, rkey: 'self' }),
      ).rejects.toThrow(refused)
      expect(await published(space, POLICY)).toHaveLength(1)
    })
  })

  describe('personalspace policy', () => {
    it('authorizes only the authority to read', async () => {
      const space = await sc.createSpace(alice, {
        policy: personalspace.policy.$build({}),
      })

      const cred = await sc.credentialFor(alice, space)
      expect(cred.credential).toBeDefined()

      const token = await sc.delegationTokenFor(carol, space)
      await expect(sc.mintCredential(space, token)).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
    })

    it('tracks no writer but the authority', async () => {
      const space = await sc.createSpace(alice, {
        policy: personalspace.policy.$build({}),
      })
      await sc.write(alice, space, { text: 'my bookmark' })
      // Bob may still write to his own repo in the space, but the authority
      // refuses his notification, so no syncer discovers it.
      await sc.write(bob, space, { text: 'not tracked' })

      expect(await sc.writerDids(space)).toEqual([alice.did])
    })
  })

  describe('credential mint gates', () => {
    it('mints for a non-member when read access is public', async () => {
      const space = await sc.createSpace(alice, {
        policy: memberspace.policy.$build({ publicRead: true }),
      })
      const cred = await sc.credentialFor(carol, space)
      expect(cred.credential).toBeDefined()
    })

    it('mints without a delegation token when read access is public', async () => {
      const space = await sc.createSpace(alice, {
        policy: memberspace.policy.$build({ publicRead: true }),
      })
      await sc.write(alice, space, { text: 'for anyone' })

      const cred = await sc.publicCredential(space)
      const res = await cred
        .clientFor(alice.pds)
        .call(com.atproto.space.listRecords, { space, repo: alice.did })
      expect(res.records).toHaveLength(1)
    })

    it.each([
      { name: 'memberspace', policy: memberspace.policy.$build({}) },
      { name: 'personalspace', policy: personalspace.policy.$build({}) },
      {
        name: 'managedspace',
        policy: managedspace.policy.$build({
          managingApp: 'did:web:unreachable.invalid#forum',
        }),
      },
    ])(
      'hides a $name space from a request without a delegation token',
      async ({ policy }) => {
        const space = await sc.createSpace(alice, { policy })
        await expect(sc.publicCredential(space)).rejects.toMatchObject({
          error: 'SpaceNotFound',
        })
      },
    )

    it('hides a space from a request without a delegation token before checking the app', async () => {
      // An AppNotAuthorized here would disclose that the space exists.
      const space = await sc.createSpace(alice, {
        policy: memberspace.policy.$build({
          allowedApps: ['https://app.example.com/client-metadata.json'],
        }),
      })
      await expect(sc.publicCredential(space)).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
    })

    it('refuses a request without a delegation token or attestation when apps are restricted', async () => {
      const space = await sc.createSpace(alice, {
        policy: memberspace.policy.$build({
          publicRead: true,
          allowedApps: ['https://app.example.com/client-metadata.json'],
        }),
      })
      await expect(sc.publicCredential(space)).rejects.toMatchObject({
        error: 'AppNotAuthorized',
      })
    })

    it('hides the space from a non-member when read access is not public', async () => {
      const space = await sc.createSpace(alice)
      const token = await sc.delegationTokenFor(carol, space)
      await expect(sc.mintCredential(space, token)).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
    })

    it('hides the space from a non-member before checking the app', async () => {
      // An AppNotAuthorized here would disclose to a non-member that the space
      // exists, and that it restricts apps.
      const space = await sc.createSpace(alice, {
        policy: memberspace.policy.$build({
          allowedApps: ['https://app.example.com/client-metadata.json'],
        }),
      })
      const token = await sc.delegationTokenFor(carol, space)
      await expect(sc.mintCredential(space, token)).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
    })

    it('hides the space from a member without read access', async () => {
      const space = await sc.createSpace(alice)
      await sc.putMember(alice, space, carol, { read: false, write: true })

      const token = await sc.delegationTokenFor(carol, space)
      await expect(sc.mintCredential(space, token)).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
    })

    it('always admits the authority, whatever the policy', async () => {
      // The authority is the only party who can reconfigure the space, so it must
      // not be able to lock itself out.
      const space = await sc.createSpace(alice, {
        policy: managedspace.policy.$build({
          managingApp: 'did:web:unreachable.invalid#forum',
        }),
      })
      const cred = await sc.credentialFor(alice, space)
      expect(cred.credential).toBeDefined()
    })

    it('refuses when apps are restricted and no attestation is presented', async () => {
      // publicRead so the user passes; allowedApps wants an attested
      // client_id, which a plain exchange doesn't supply.
      const space = await sc.createSpace(alice, {
        policy: memberspace.policy.$build({
          publicRead: true,
          allowedApps: ['https://app.example.com/client-metadata.json'],
        }),
      })
      const token = await sc.delegationTokenFor(carol, space)
      await expect(sc.mintCredential(space, token)).rejects.toMatchObject({
        error: 'AppNotAuthorized',
      })
    })

    /**
     * An allow-listed `client_id` is only worth something if the attestation
     * carrying it is checked against the key that client publishes — otherwise
     * anyone can name an allow-listed app and be believed.
     *
     * These use a client whose metadata and JWKS are served over real HTTP, so
     * the mint path resolves and verifies for real. `client-attestation.test.ts`
     * unit-tests the verifier's own edge cases against an injected fetch.
     */
    describe('client attestation', () => {
      const spaceFor = (app: MockClientApp) =>
        sc.createSpace(alice, {
          policy: memberspace.policy.$build({
            publicRead: true,
            allowedApps: [app.clientId],
          }),
        })

      const mint = (
        space: SpaceRefString,
        token: string,
        attestation: string,
      ) => sc.mintCredential(space, token, { clientAttestation: attestation })

      it('mints for an allow-listed app that signs with its published key', async () => {
        await using app = await MockClientApp.create()
        using _installed = app.installOn(network.pds)
        const space = await spaceFor(app)

        const token = await sc.delegationTokenFor(carol, space)
        const res = await mint(
          space,
          token,
          await app.attest(spaceHostAud(alice.did)),
        )
        expect(res.credential).toBeDefined()
      })

      it('refuses an attestation signed by a key the app does not publish', async () => {
        // The forgery the whole check exists to stop: carol claims to be the
        // allow-listed app and signs with a key of her own. The client_id and
        // audience are both exactly right, so only the signature stands in the
        // way — and this must fail there, not at metadata resolution.
        await using app = await MockClientApp.create()
        using _installed = app.installOn(network.pds)
        const space = await spaceFor(app)

        const attackerKey = await JoseKey.generate(['ES256'], 'key-1')
        const forged = await app.attest(spaceHostAud(alice.did), {
          signWith: attackerKey,
        })

        const token = await sc.delegationTokenFor(carol, space)
        await expect(mint(space, token, forged)).rejects.toThrow(
          /Invalid client attestation/,
        )
      })

      it('refuses an attestation addressed to another authority', async () => {
        await using app = await MockClientApp.create()
        using _installed = app.installOn(network.pds)
        const space = await spaceFor(app)

        const token = await sc.delegationTokenFor(carol, space)
        await expect(
          mint(space, token, await app.attest(spaceHostAud(bob.did))),
        ).rejects.toThrow(/Invalid client attestation/)
      })

      it('refuses an attestation from an app that is not allow-listed', async () => {
        // A genuine attestation, correctly signed — for an app this space never
        // allowed. Verification passing is not the same as being admitted.
        await using allowed = await MockClientApp.create()
        await using other = await MockClientApp.create()
        using _installed = other.installOn(network.pds)
        const space = await spaceFor(allowed)

        const token = await sc.delegationTokenFor(carol, space)
        await expect(
          mint(space, token, await other.attest(spaceHostAud(alice.did))),
        ).rejects.toMatchObject({ error: 'AppNotAuthorized' })
      })

      it('mints for an allow-listed app without a delegation token', async () => {
        await using app = await MockClientApp.create()
        using _installed = app.installOn(network.pds)
        const space = await spaceFor(app)

        const cred = await sc.publicCredential(space, {
          clientAttestation: await app.attest(spaceHostAud(alice.did)),
        })
        expect(cred.credential).toBeDefined()
      })

      it('refuses an expired attestation', async () => {
        await using app = await MockClientApp.create()
        using _installed = app.installOn(network.pds)
        const space = await spaceFor(app)

        const token = await sc.delegationTokenFor(carol, space)
        await expect(
          mint(
            space,
            token,
            await app.attest(spaceHostAud(alice.did), { expiresInSec: -120 }),
          ),
        ).rejects.toThrow(/Invalid client attestation/)
      })
    })

    describe('managedspace policy', () => {
      // The managing-app hook: the authority asks a third-party app whether a
      // user may join. Everything here is about trusting that answer — and about
      // what happens when there isn't one.
      const spaceWith = async (app: MockService | string) =>
        sc.createSpace(alice, {
          policy: managedspace.policy.$build({
            managingApp: typeof app === 'string' ? app : app.serviceRef,
          }),
        })

      it('admits a user the managing app authorizes', async () => {
        await using app = await MockService.create(network, {
          serviceId: 'atproto_forum',
          respond: () => ({ status: 200, body: { authorized: true } }),
        })
        const space = await spaceWith(app)

        const cred = await sc.credentialFor(carol, space)
        expect(cred.credential).toBeDefined()

        // It was actually consulted, and told who was asking.
        const asked = app.callsTo('com.atproto.managedspace.checkUserAccess')
        expect(asked).toHaveLength(1)
        expect(asked[0].body).toMatchObject({
          space,
          user: carol.did,
          access: 'read',
        })
        // Addressed with service auth from the authority, so the app can tell
        // who is asking it.
        expect(asked[0].auth).toMatch(/^Bearer /)
      })

      it('refuses a user the managing app declines', async () => {
        await using app = await MockService.create(network, {
          serviceId: 'atproto_forum',
          respond: () => ({ status: 200, body: { authorized: false } }),
        })
        const space = await spaceWith(app)

        const token = await sc.delegationTokenFor(carol, space)
        await expect(sc.mintCredential(space, token)).rejects.toMatchObject({
          error: 'SpaceNotFound',
        })
      })

      it('denies when the managing app errors', async () => {
        // Failing open would hand out credentials for exactly the spaces that
        // asked for the strictest gate.
        await using app = await MockService.create(network, {
          serviceId: 'atproto_forum',
          respond: () => ({ status: 500, body: { error: 'InternalError' } }),
        })
        const space = await spaceWith(app)

        const token = await sc.delegationTokenFor(carol, space)
        await expect(sc.mintCredential(space, token)).rejects.toMatchObject({
          error: 'SpaceNotFound',
        })
      })

      it('denies when the managing app cannot be resolved', async () => {
        // Same reasoning as an error response: an unreachable gate is a closed one.
        const space = await spaceWith('did:web:nonexistent.invalid#forum')
        const token = await sc.delegationTokenFor(carol, space)
        await expect(sc.mintCredential(space, token)).rejects.toMatchObject({
          error: 'SpaceNotFound',
        })
      })

      it('records a writer the managing app admits', async () => {
        await using app = await MockService.create(network, {
          serviceId: 'atproto_forum',
          respond: () => ({ status: 200, body: { authorized: true } }),
        })
        const space = await spaceWith(app)

        await sc.write(bob, space, { text: 'admitted by the managing app' })
        const dids = await sc.awaitNotify(
          () => sc.writerDids(space),
          (all) => all.includes(bob.did),
        )
        expect(dids).toContain(bob.did)
        expect(
          app.callsTo('com.atproto.managedspace.checkUserAccess')[0].body,
        ).toMatchObject({ space, user: bob.did, access: 'write' })
      })
    })
  })

  /**
   * Notification fan-out. A syncing service registers with the authority and is
   * told about writes; deliveries are best-effort and run on a background queue,
   * so tests drain it rather than polling.
   */
  describe('notify registration', () => {
    it('registers, forwards writes, and stops once withdrawn', async () => {
      await using syncer = await MockService.create(network, {
        serviceId: 'atproto_space_syncer',
      })
      const space = await sc.createSpace(alice, { members: [bob, carol] })
      const cred = await sc.credentialFor(carol, space)
      const asSyncer = cred.clientFor(alice.pds)

      const reg = await asSyncer.call(com.atproto.space.registerNotify, {
        space,
        service: syncer.serviceRef,
      })
      // The registration expires, and the caller is told when: a syncer has to
      // renew rather than assume it stays registered forever.
      expect(reg.expiresAt).toBeDefined()

      await sc.write(bob, space, { text: 'forwarded' })
      // The authority's fan-out is queued so the writer's PDS isn't kept waiting.
      await sc.awaitNotify(
        async () => syncer.callsTo('com.atproto.space.notifyWrite'),
        (calls) => calls.length > 0,
      )
      await network.pds.ctx.backgroundQueue.processAll()

      const delivered = syncer.callsTo('com.atproto.space.notifyWrite')
      expect(delivered.length).toBeGreaterThan(0)
      expect(delivered[0].body).toMatchObject({ space, repo: bob.did })

      // Withdrawn: no further deliveries.
      await asSyncer.call(com.atproto.space.unregisterNotify, {
        space,
        service: syncer.serviceRef,
      })
      const before = syncer.callsTo('com.atproto.space.notifyWrite').length
      await sc.write(bob, space, { text: 'not forwarded' })
      await network.pds.ctx.backgroundQueue.processAll()
      expect(syncer.callsTo('com.atproto.space.notifyWrite')).toHaveLength(
        before,
      )

      // Unregistering again is idempotent.
      await asSyncer.call(com.atproto.space.unregisterNotify, {
        space,
        service: syncer.serviceRef,
      })
    })

    it('stops delivering to a registration past its expiry, and resumes on renewal', async () => {
      await using syncer = await MockService.create(network, {
        serviceId: 'atproto_space_syncer',
      })
      const space = await sc.createSpace(alice, { members: [bob, carol] })
      const cred = await sc.credentialFor(carol, space)
      const asSyncer = cred.clientFor(alice.pds)

      await asSyncer.call(com.atproto.space.registerNotify, {
        space,
        service: syncer.serviceRef,
      })

      // Expire it rather than waiting out the TTL. No endpoint does this, so it
      // reaches into storage deliberately.
      await network.pds.ctx.actorStore.transact(alice.did, (actorTxn) =>
        actorTxn.space.db.db
          .updateTable('space_credential_recipient')
          .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
          .where('space', '=', space)
          .execute(),
      )

      await sc.write(bob, space, { text: 'after expiry' })
      await network.pds.ctx.backgroundQueue.processAll()
      expect(syncer.callsTo('com.atproto.space.notifyWrite')).toHaveLength(0)

      // Renewing brings it back — the row was withheld, not dropped.
      await asSyncer.call(com.atproto.space.registerNotify, {
        space,
        service: syncer.serviceRef,
      })
      await sc.write(bob, space, { text: 'after renewal' })
      await sc.awaitNotify(
        async () => syncer.callsTo('com.atproto.space.notifyWrite'),
        (calls) => calls.length > 0,
      )
      await network.pds.ctx.backgroundQueue.processAll()
      expect(
        syncer.callsTo('com.atproto.space.notifyWrite').length,
      ).toBeGreaterThan(0)
    })

    it('refuses a service that cannot be resolved', async () => {
      const space = await sc.createSpace(alice, { members: [carol] })
      const cred = await sc.credentialFor(carol, space)
      await expect(
        cred.clientFor(alice.pds).call(com.atproto.space.registerNotify, {
          space,
          service: 'did:web:nonexistent.invalid#syncer',
        }),
      ).rejects.toMatchObject({ error: 'ServiceNotResolvable' })
    })
  })

  describe('deletion', () => {
    const deleteSpace = (space: SpaceRefString) =>
      alice.client.call(
        com.atproto.space.deleteSpace,
        { space },
        { headers: alice.headers },
      )

    it('purges the authority own repo and keeps a tombstone', async () => {
      const space = await sc.createSpace(alice, { members: [bob] })
      const { body: uploaded } = await alice.client.uploadBlob(
        Buffer.from('space blob for deletion'),
        { headers: alice.headers, encoding: 'application/octet-stream' },
      )
      const blobCid = getBlobCidString(uploaded.blob)
      await sc.write(alice, space, {
        rkey: 'doomed',
        record: {
          $type: TEST_COLLECTION,
          text: 'owner record',
          image: uploaded.blob,
        },
      })
      expect(await sc.blobExists(alice, blobCid)).toBe(true)

      await deleteSpace(space)

      const [spaceRow, policy, records, members] =
        await network.pds.ctx.actorStore.read(alice.did, async (store) => [
          await store.space.getSpace(space),
          await store.space.getSpacePolicy(space),
          await store.space.listRecords(space, { limit: 10 }),
          await store.space.listMembers(space, { limit: 10 }),
        ])
      // The row survives as a tombstone, so getSpaceCredential can keep
      // answering SpaceDeleted; everything it held is gone.
      expect(spaceRow?.deletedAt).toBeDefined()
      expect(policy).toBeNull()
      expect(records).toEqual([])
      expect(members).toEqual([])
      expect(await sc.blobExists(alice, blobCid)).toBe(false)

      await expect(getSpace(space)).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })

      // Idempotent.
      await deleteSpace(space)
    })

    it('answers SpaceDeleted on credential renewal', async () => {
      // The durable drop signal: a syncer that missed notifySpaceDeleted learns
      // the space is gone here, and can tell it apart from an authority that is
      // merely down.
      const space = await sc.createSpace(alice, { members: [carol] })
      const token = await sc.delegationTokenFor(carol, space)

      await deleteSpace(space)

      await expect(sc.mintCredential(space, token)).rejects.toMatchObject({
        error: 'SpaceDeleted',
      })
    })

    it('answers SpaceDeleted to a request without a delegation token', async () => {
      // A public space's syncer may hold no delegation token, and still needs to
      // learn that the space is gone.
      const space = await sc.createSpace(alice, {
        policy: memberspace.policy.$build({ publicRead: true }),
      })
      await deleteSpace(space)
      await expect(sc.publicCredential(space)).rejects.toMatchObject({
        error: 'SpaceDeleted',
      })
    })

    it('notifies registered syncers', async () => {
      await using syncer = await MockService.create(network, {
        serviceId: 'atproto_space_syncer',
      })
      const space = await sc.createSpace(alice, { members: [carol] })
      const cred = await sc.credentialFor(carol, space)
      await cred.clientFor(alice.pds).call(com.atproto.space.registerNotify, {
        space,
        service: syncer.serviceRef,
      })

      await deleteSpace(space)
      await network.pds.ctx.backgroundQueue.processAll()

      const delivered = syncer.callsTo('com.atproto.space.notifySpaceDeleted')
      expect(delivered).toHaveLength(1)
      expect(delivered[0].body).toMatchObject({ space })
    })

    it('leaves a member repo untouched', async () => {
      // A member's PDS is never notified: the records are the member's own, and
      // it is the application's job to tell them the space is gone. What deletion
      // takes away is the ability to get a credential to read them.
      const space = await sc.createSpace(alice, { members: [bob] })
      await sc.write(bob, space, { text: 'member write' })

      await deleteSpace(space)
      await network.pds.ctx.backgroundQueue.processAll()

      const [spaceRow, records] = await bob.pds.ctx.actorStore.read(
        bob.did,
        async (store) => [
          await store.space.getSpace(space),
          await store.space.listRecords(space, { limit: 10 }),
        ],
      )
      expect(spaceRow?.deletedAt).toBeNull()
      expect(records).toHaveLength(1)
    })

    it('allows re-creating a deleted space, with a fresh policy', async () => {
      const skey = 'recreate'
      const space = await sc.createSpace(alice, {
        skey,
        policy: memberspace.policy.$build({
          publicRead: true,
          publicWrite: true,
        }),
      })
      await deleteSpace(space)

      const recreated = await sc.createSpace(alice, { skey })
      expect(recreated).toBe(space)

      // Reset, not revived: the deleted space's public access must not carry
      // over into the new one.
      const got = await getSpace(space)
      expect(got.policy).toMatchObject({
        publicRead: false,
        publicWrite: false,
      })

      await expect(
        sc.write(alice, space, { text: 'after recreation' }),
      ).resolves.toBeDefined()
    })
  })
})
