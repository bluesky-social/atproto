import { TestNetworkNoAppView } from '@atproto/dev-env'
import { getBlobCidString } from '@atproto/lex-data'
import { JoseKey } from '@atproto/oauth-provider/provider'
import { spaceHostAud } from '@atproto/space'
import type { SpaceRefString } from '@atproto/syntax'
import { com } from '../../src/lexicons/index.js'
import {
  type Actor,
  MockClientApp,
  MockService,
  SpaceClient,
  TEST_COLLECTION,
  TEST_SPACE_TYPE,
} from '../_space.js'

const { defs } = com.atproto.simplespace

/**
 * `com.atproto.simplespace` — the policy layer.
 *
 * This is deliberately not protocol: `com.atproto.space` says how a space's data
 * moves, and simplespace is one answer to who's allowed in. The protocol side only
 * ever asks the authority "may this user read?"; every decision behind that
 * question lives here.
 */
describe('simplespace', () => {
  let network: TestNetworkNoAppView
  let sc: SpaceClient
  let alice: Actor // authority / owner
  let dan: Actor // co-located with the authority
  let bob: Actor // on pds2
  let carol: Actor // on pds3

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'space_simplespace',
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
          com.atproto.simplespace.createSpace,
          {
            type: TEST_SPACE_TYPE,
            skey: space.split('/').pop()!,
            policy: defs.memberListPolicy.build({}),
            appAccess: defs.open.build({}),
          },
          { headers: alice.headers },
        ),
      ).rejects.toMatchObject({ error: 'SpaceAlreadyExists' })
    })

    it('refuses a space key that is not a valid record key', async () => {
      await expect(
        alice.client.call(
          com.atproto.simplespace.createSpace,
          {
            type: TEST_SPACE_TYPE,
            skey: 'not a valid rkey',
            policy: defs.memberListPolicy.build({}),
            appAccess: defs.open.build({}),
          },
          { headers: alice.headers },
        ),
      ).rejects.toThrow(/record key/i)
    })

    it('governs a space written to before createSpace', async () => {
      // Writing to at://me/space/<type>/<skey> materializes a repo but does not
      // create a simplespace: there is no config until the owner asks for one,
      // and no default to guess at. So the space isn't administrable yet, and
      // createSpace over the existing repo is what makes it so.
      const skey = 'lazy'
      const space =
        `at://${alice.did}/space/${TEST_SPACE_TYPE}/${skey}` as SpaceRefString
      await sc.write(alice, space, { text: 'lazy space' })

      await expect(
        alice.client.call(
          com.atproto.simplespace.getSpace,
          { space },
          { headers: alice.headers },
        ),
      ).rejects.toMatchObject({ error: 'SpaceNotFound' })
      await expect(sc.addMember(alice, space, bob)).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })

      await sc.createSpace(alice, { skey })
      await sc.addMember(alice, space, bob)

      const got = await alice.client.call(
        com.atproto.simplespace.getSpace,
        { space },
        { headers: alice.headers },
      )
      expect(got.policy.$type).toBe(
        'com.atproto.simplespace.defs#memberListPolicy',
      )

      // And the records that were already there stay put.
      const listed = await alice.client.call(
        com.atproto.space.listRecords,
        { space, repo: alice.did },
        { headers: alice.headers },
      )
      expect(listed.records).toHaveLength(1)
    })
  })

  describe('members', () => {
    it('adds and removes members, and the owner is not one of them', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.addMember(alice, space, bob)

      const members = await alice.client.call(
        com.atproto.simplespace.listMembers,
        { space },
        { headers: alice.headers },
      )
      const dids = members.members.map((m) => m.did)
      // Alice is the authority, which is checked against the space uri rather
      // than carried on the member list.
      expect(dids).not.toContain(alice.did)
      expect(dids).toContain(dan.did)
      expect(dids).toContain(bob.did)

      await sc.removeMember(alice, space, bob)
      const after = await alice.client.call(
        com.atproto.simplespace.listMembers,
        { space },
        { headers: alice.headers },
      )
      expect(after.members.map((m) => m.did)).not.toContain(bob.did)
    })

    it('refuses membership changes from a non-owner member', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await expect(
        dan.client.call(
          com.atproto.simplespace.addMember,
          { space, did: carol.did },
          { headers: dan.headers },
        ),
      ).rejects.toMatchObject({ error: 'NotSpaceOwner' })
      await expect(
        dan.client.call(
          com.atproto.simplespace.removeMember,
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
          .call(com.atproto.simplespace.listMembers, { space }),
      ).rejects.toThrow()

      // Dan is co-located with the authority, but the space is not his.
      await expect(
        alice.client.call(
          com.atproto.simplespace.listMembers,
          { space },
          { headers: dan.headers },
        ),
      ).rejects.toMatchObject({ error: 'NotSpaceOwner' })
    })

    it('adding a member twice is idempotent', async () => {
      const space = await sc.createSpace(alice)
      await sc.addMember(alice, space, bob)
      await sc.addMember(alice, space, bob)

      const members = await alice.client.call(
        com.atproto.simplespace.listMembers,
        { space },
        { headers: alice.headers },
      )
      expect(members.members.filter((m) => m.did === bob.did)).toHaveLength(1)
    })
  })

  describe('config', () => {
    it('persists what createSpace was given', async () => {
      const space = await sc.createSpace(alice, {
        policy: defs.managingAppPolicy.build({
          managingApp: 'did:web:example.com#forum',
        }),
        appAccess: defs.allowList.build({ allowed: ['app:one', 'app:two'] }),
      })

      const got = await alice.client.call(
        com.atproto.simplespace.getSpace,
        { space },
        { headers: alice.headers },
      )
      expect(got.uri).toBe(space)
      expect(got.policy).toEqual({
        $type: 'com.atproto.simplespace.defs#managingAppPolicy',
        managingApp: 'did:web:example.com#forum',
      })
      expect(got.appAccess).toMatchObject({
        $type: 'com.atproto.simplespace.defs#allowList',
        allowed: ['app:one', 'app:two'],
      })
    })

    it('defaults to a member-list, open space', async () => {
      const space = await sc.createSpace(alice)
      const got = await alice.client.call(
        com.atproto.simplespace.getSpace,
        { space },
        { headers: alice.headers },
      )
      expect(got.policy).toEqual({
        $type: 'com.atproto.simplespace.defs#memberListPolicy',
      })
      expect(got.appAccess).toMatchObject({
        $type: 'com.atproto.simplespace.defs#open',
      })
    })

    it('patches policy and appAccess independently', async () => {
      const space = await sc.createSpace(alice)

      await alice.client.call(
        com.atproto.simplespace.updateSpace,
        { space, policy: defs.publicPolicy.build({}) },
        { headers: alice.headers },
      )
      await alice.client.call(
        com.atproto.simplespace.updateSpace,
        { space, appAccess: defs.allowList.build({ allowed: ['app:x'] }) },
        { headers: alice.headers },
      )

      const got = await alice.client.call(
        com.atproto.simplespace.getSpace,
        { space },
        { headers: alice.headers },
      )
      // The second update left the first alone.
      expect(got.policy.$type).toBe('com.atproto.simplespace.defs#publicPolicy')
      expect(got.appAccess).toMatchObject({
        $type: 'com.atproto.simplespace.defs#allowList',
        allowed: ['app:x'],
      })
    })

    it('drops managingApp by switching policy', async () => {
      const space = await sc.createSpace(alice, {
        policy: defs.managingAppPolicy.build({
          managingApp: 'did:web:example.com#forum',
        }),
      })
      await alice.client.call(
        com.atproto.simplespace.updateSpace,
        { space, policy: defs.memberListPolicy.build({}) },
        { headers: alice.headers },
      )
      const got = await alice.client.call(
        com.atproto.simplespace.getSpace,
        { space },
        { headers: alice.headers },
      )
      // No stale managingApp left hanging off the new policy.
      expect(got.policy).toEqual({
        $type: 'com.atproto.simplespace.defs#memberListPolicy',
      })
    })

    it('refuses an update from a non-owner', async () => {
      const space = await sc.createSpace(alice, { members: [bob] })
      await expect(
        alice.client.call(
          com.atproto.simplespace.updateSpace,
          { space, policy: defs.publicPolicy.build({}) },
          { headers: bob.headers },
        ),
      ).rejects.toThrow()
    })

    it('refuses an unrecognized appAccess variant rather than widening the space', async () => {
      // appAccess is an open union, so an unknown variant is well-formed on the
      // wire. Storing it would mean enforcing something weaker than the owner
      // asked for.
      const space = await sc.createSpace(alice, {
        appAccess: defs.allowList.build({ allowed: ['app:one'] }),
      })

      await expect(
        alice.client.call(
          com.atproto.simplespace.updateSpace,
          {
            space,
            appAccess: { $type: 'com.example.denyEverything' } as never,
          },
          { headers: alice.headers },
        ),
      ).rejects.toMatchObject({ error: 'UnsupportedAppAccess' })

      // ...and the previous setting survives the refusal.
      const got = await alice.client.call(
        com.atproto.simplespace.getSpace,
        { space },
        { headers: alice.headers },
      )
      expect(got.appAccess).toMatchObject({
        $type: 'com.atproto.simplespace.defs#allowList',
        allowed: ['app:one'],
      })
    })

    it('refuses an unrecognized policy variant', async () => {
      const space = await sc.createSpace(alice)
      await expect(
        alice.client.call(
          com.atproto.simplespace.updateSpace,
          { space, policy: { $type: 'com.example.whatever' } as never },
          { headers: alice.headers },
        ),
      ).rejects.toMatchObject({ error: 'UnsupportedPolicy' })
    })

    it('refuses a managingApp that does not name a service', async () => {
      const space = await sc.createSpace(alice)
      await expect(
        alice.client.call(
          com.atproto.simplespace.updateSpace,
          {
            space,
            policy: defs.managingAppPolicy.build({
              managingApp: 'not-a-did-at-all',
            }),
          },
          { headers: alice.headers },
        ),
      ).rejects.toThrow(/must be a DID/)
    })

    it('serves the config to a member with a space credential', async () => {
      const space = await sc.createSpace(alice, { members: [carol] })
      const cred = await sc.credentialFor(carol, space)

      const got = await cred
        .clientFor(alice.pds)
        .call(com.atproto.simplespace.getSpace, { space })
      expect(got.uri).toBe(space)
      expect(got.policy.$type).toBe(
        'com.atproto.simplespace.defs#memberListPolicy',
      )
    })

    it('refuses the config to a credential for another space', async () => {
      const space = await sc.createSpace(alice, {
        skey: 'cfg-wrong',
        members: [carol],
      })
      const other = await sc.createSpace(alice, {
        skey: 'cfg-wrong-other',
        members: [carol],
      })
      const cred = await sc.credentialFor(carol, other)

      await expect(
        cred
          .clientFor(alice.pds)
          .call(com.atproto.simplespace.getSpace, { space }),
      ).rejects.toThrow()
    })

    it('refuses to answer for a space this host does not govern', async () => {
      // pds2 hosts no account for alice, so it holds no config to answer from.
      const space = await sc.createSpace(alice, { members: [bob] })
      const cred = await sc.credentialFor(bob, space)

      // The error names the space rather than leaking it as a missing repo.
      await expect(
        cred.clientFor(bob.pds).call(com.atproto.space.listRepos, { space }),
      ).rejects.toMatchObject({ error: 'SpaceNotFound' })
      await expect(
        bob.client.call(
          com.atproto.simplespace.getSpace,
          { space },
          { headers: bob.headers },
        ),
      ).rejects.toThrow()
    })
  })

  /**
   * Which policy admits whom. This is the decision `getSpaceCredential` makes,
   * and the same one `notifyWrite` makes when it records a writer — they have to
   * agree, or the writer set diverges from who can read.
   */
  describe('credential mint gates', () => {
    it('mints for a non-member when the policy is public', async () => {
      const space = await sc.createSpace(alice, {
        policy: defs.publicPolicy.build({}),
      })
      const cred = await sc.credentialFor(carol, space)
      expect(cred.credential).toBeDefined()
    })

    it('refuses a non-member under member-list policy', async () => {
      const space = await sc.createSpace(alice)
      const token = await sc.delegationTokenFor(carol, space)
      await expect(sc.mintCredential(space, token)).rejects.toMatchObject({
        error: 'UserNotAuthorized',
      })
    })

    it('always admits the authority, whatever the policy', async () => {
      // The authority is the only party who can reconfigure the space, so it must
      // not be able to lock itself out.
      const space = await sc.createSpace(alice, {
        policy: defs.managingAppPolicy.build({
          managingApp: 'did:web:unreachable.invalid#forum',
        }),
      })
      const cred = await sc.credentialFor(alice, space)
      expect(cred.credential).toBeDefined()
    })

    it('refuses when appAccess is an allowList and no attestation is presented', async () => {
      // policy public so the user passes; appAccess allowList wants an attested
      // client_id, which a plain exchange doesn't supply.
      const space = await sc.createSpace(alice, {
        policy: defs.publicPolicy.build({}),
        appAccess: defs.allowList.build({
          allowed: ['https://app.example.com/client-metadata.json'],
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
          policy: defs.publicPolicy.build({}),
          appAccess: defs.allowList.build({ allowed: [app.clientId] }),
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

    describe('managing-app policy', () => {
      // The managing-app hook: the authority asks a third-party app whether a
      // user may join. Everything here is about trusting that answer — and about
      // what happens when there isn't one.
      const spaceWith = async (app: MockService | string) =>
        sc.createSpace(alice, {
          policy: defs.managingAppPolicy.build({
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
        const asked = app.callsTo('com.atproto.simplespace.checkUserAccess')
        expect(asked).toHaveLength(1)
        expect(asked[0].body).toMatchObject({ space, user: carol.did })
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
          error: 'UserNotAuthorized',
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
          error: 'UserNotAuthorized',
        })
      })

      it('denies when the managing app cannot be resolved', async () => {
        // Same reasoning as an error response: an unreachable gate is a closed one.
        const space = await spaceWith('did:web:nonexistent.invalid#forum')
        const token = await sc.delegationTokenFor(carol, space)
        await expect(sc.mintCredential(space, token)).rejects.toMatchObject({
          error: 'UserNotAuthorized',
        })
      })

      it('records a writer the managing app admits', async () => {
        // notifyWrite consults the same gate, so the writer set can't drift from
        // who may read the space.
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

      await alice.client.call(
        com.atproto.simplespace.deleteSpace,
        { space },
        { headers: alice.headers },
      )

      const [spaceRow, records, members] =
        await network.pds.ctx.actorStore.read(alice.did, async (store) => [
          await store.space.getSpace(space),
          await store.space.listRecords(space, { limit: 10 }),
          await store.space.listMembers(space, { limit: 10 }),
        ])
      // The row survives as a tombstone, so getSpaceCredential can keep
      // answering SpaceDeleted; everything it held is gone.
      expect(spaceRow?.deletedAt).toBeDefined()
      expect(records).toEqual([])
      expect(members).toEqual([])
      expect(await sc.blobExists(alice, blobCid)).toBe(false)

      await expect(
        alice.client.call(
          com.atproto.simplespace.getSpace,
          { space },
          { headers: alice.headers },
        ),
      ).rejects.toMatchObject({ error: 'SpaceNotFound' })

      // Idempotent.
      await alice.client.call(
        com.atproto.simplespace.deleteSpace,
        { space },
        { headers: alice.headers },
      )
    })

    it('answers SpaceDeleted on credential renewal', async () => {
      // The durable drop signal: a syncer that missed notifySpaceDeleted learns
      // the space is gone here, and can tell it apart from an authority that is
      // merely down.
      const space = await sc.createSpace(alice, { members: [carol] })
      const token = await sc.delegationTokenFor(carol, space)

      await alice.client.call(
        com.atproto.simplespace.deleteSpace,
        { space },
        { headers: alice.headers },
      )

      await expect(sc.mintCredential(space, token)).rejects.toMatchObject({
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

      await alice.client.call(
        com.atproto.simplespace.deleteSpace,
        { space },
        { headers: alice.headers },
      )
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

      await alice.client.call(
        com.atproto.simplespace.deleteSpace,
        { space },
        { headers: alice.headers },
      )
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

    it('allows re-creating a deleted space, with fresh config', async () => {
      const skey = 'recreate'
      const space = await sc.createSpace(alice, {
        skey,
        policy: defs.publicPolicy.build({}),
      })
      await alice.client.call(
        com.atproto.simplespace.deleteSpace,
        { space },
        { headers: alice.headers },
      )

      const recreated = await sc.createSpace(alice, { skey })
      expect(recreated).toBe(space)

      // Reset, not revived: the deleted space's `public` policy must not carry
      // over into the new one.
      const got = await alice.client.call(
        com.atproto.simplespace.getSpace,
        { space },
        { headers: alice.headers },
      )
      expect(got.policy.$type).toBe(
        'com.atproto.simplespace.defs#memberListPolicy',
      )

      await expect(
        sc.write(alice, space, { text: 'after recreation' }),
      ).resolves.toBeDefined()
    })
  })
})
