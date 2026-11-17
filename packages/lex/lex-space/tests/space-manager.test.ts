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
import type { Client } from '@atproto/lex-client'
import { createDidResolver } from '@atproto-labs/did-resolver'
import {
  type AtprotoDidResolver,
  type BaselineSpacePolicyManager,
  ManagedspacePolicyManager,
  MemberspacePolicyManager,
  PersonalspacePolicyManager,
  SpaceClient,
  SpaceManager,
  SpacePolicyManager,
  UnsupportedSpacePolicyError,
  baselineSpacePolicies,
  managedspace,
  memberspace,
  personalspace,
} from '../src/index.js'
import { com } from '../src/lexicons/index.js'
import {
  agentOf,
  collect,
  createGroup,
  createUser,
  group,
  note,
} from './_util.js'

const managingApp = 'did:web:app.example#forum'

class AuditedPolicyManager extends SpacePolicyManager<memberspace.policy.Main> {
  static readonly schema = memberspace.policy.main

  isPublic(): boolean {
    return this.policy.publicRead === true
  }
}

describe('SpaceManager', () => {
  let network: TestNetworkNoAppView
  let didResolver: AtprotoDidResolver
  let alice: Client // space authority, on the main PDS
  let bob: Client // on another PDS

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({ extraPdses: 1 })
    didResolver = createDidResolver({
      plcDirectoryUrl: network.plc.url,
      allowHttp: true,
    })
    alice = await createUser(network.pds, 'alice.test')
    bob = await createUser(network.extraPdses[0], 'bob.test2')
  })

  afterAll(async () => {
    await network?.close()
  })

  describe('open', () => {
    it.each([
      {
        policy: memberspace.policy.$build({}),
        Manager: MemberspacePolicyManager,
      },
      {
        policy: personalspace.policy.$build({}),
        Manager: PersonalspacePolicyManager,
      },
      {
        policy: managedspace.policy.$build({ managingApp }),
        Manager: ManagedspacePolicyManager,
      },
    ])(
      'opens the baseline manager of a $policy.$type',
      async ({ policy, Manager }) => {
        const uri = await createGroup(alice, [], policy)
        const manager = await SpaceManager.open(alice.agent, uri)
        expectTypeOf(manager).toEqualTypeOf<BaselineSpacePolicyManager>()
        expect(manager).toBeInstanceOf(Manager)
        expect(manager.type).toBe(policy.$type)
      },
    )

    it('opens the first matching manager of the given policies', async () => {
      const uri = await createGroup(alice)
      const manager = await SpaceManager.open(alice.agent, uri, {
        policies: [AuditedPolicyManager, ...baselineSpacePolicies],
      })
      expectTypeOf(manager).toEqualTypeOf<
        AuditedPolicyManager | BaselineSpacePolicyManager
      >()
      assert(manager instanceof AuditedPolicyManager)
      expect(manager.isPublic()).toBe(false)
    })

    it('refuses a policy none of the managers support', async () => {
      const uri = await createGroup(alice, [], personalspace.policy.$build({}))
      const result = SpaceManager.open(alice.agent, uri, {
        policies: [MemberspacePolicyManager],
      })
      await expect(result).rejects.toBeInstanceOf(UnsupportedSpacePolicyError)
      await expect(result).rejects.toMatchObject({
        policy: { $type: personalspace.policy.$type },
      })
    })

    it('can only be used by the space authority', async () => {
      const uri = await createGroup(alice)
      expect(() => new SpaceManager(agentOf(bob), uri)).toThrow(TypeError)
      await expect(SpaceManager.open(bob.agent, uri)).rejects.toThrow(TypeError)
    })
  })

  it('puts, lists and removes the members of a memberspace', async () => {
    const manager = await SpaceManager.open(
      alice.agent,
      await createGroup(alice),
      { policies: [MemberspacePolicyManager] },
    )
    const member = { did: bob.assertDid, read: true, write: false }

    await manager.putMembers([member])
    const { members } = await manager.listMembers()
    expect(members).toEqual([member])

    await manager.removeMembers([bob.assertDid])
    expect(await collect(manager.members())).toEqual([])
  })

  describe('updatePolicy', () => {
    it('merges a partial update, or applies an updater', async () => {
      const uri = await createGroup(alice)
      const manager = await SpaceManager.open(alice.agent, uri, {
        policies: [MemberspacePolicyManager],
      })
      expectTypeOf(manager).toEqualTypeOf<MemberspacePolicyManager>()

      await manager.updatePolicy({ publicRead: true })
      expect(manager.policy).toMatchObject({ publicRead: true })

      await manager.updatePolicy((current) => ({
        ...current,
        allowedApps: ['https://app.example/client.json'],
      }))
      const { policy } = await new SpaceManager(agentOf(alice), uri).getSpace()
      expect(policy).toMatchObject({
        $type: memberspace.policy.$type,
        publicRead: true,
        allowedApps: ['https://app.example/client.json'],
      })
    })

    it("applies the update to the host's current policy", async () => {
      const uri = await createGroup(alice)
      const open = () =>
        SpaceManager.open(alice.agent, uri, {
          policies: [MemberspacePolicyManager],
        })
      const [manager, stale] = await Promise.all([open(), open()])

      await manager.updatePolicy({ publicRead: true })
      await stale.updatePolicy({
        allowedApps: ['https://app.example/client.json'],
      })

      const { policy } = await new SpaceManager(agentOf(alice), uri).getSpace()
      expect(policy).toMatchObject({
        publicRead: true,
        allowedApps: ['https://app.example/client.json'],
      })
    })
  })

  it('migrates a space to another policy', async () => {
    const space = new SpaceManager(agentOf(alice), await createGroup(alice))

    await space.updateSpace(managedspace.policy.$build({ managingApp }))

    const manager = await space.managePolicy()
    expect(manager).toBeInstanceOf(ManagedspacePolicyManager)
    expect(manager.policy).toMatchObject({ managingApp })
  })

  it('removes a writer from the writer set', async () => {
    const uri = await createGroup(alice, [bob])
    await SpaceClient.openSpace(group, uri, { agent: bob.agent }).create(note, {
      text: 'from bob',
    })

    await new SpaceManager(agentOf(alice), uri).removeWriter(bob.assertDid)

    const aliceSpace = SpaceClient.openSpace(group, uri, {
      agent: alice.agent,
      didResolver,
    })
    expect(await collect(aliceSpace.writers())).toEqual([
      expect.objectContaining({
        $type: com.atproto.space.defs.repoRemoved.$type,
        repo: bob.assertDid,
      }),
    ])
  })

  it('deletes a space', async () => {
    const space = new SpaceManager(agentOf(alice), await createGroup(alice))
    await space.deleteSpace()
    await expect(space.getSpace()).rejects.toMatchObject({
      error: 'SpaceNotFound',
    })
  })
})
