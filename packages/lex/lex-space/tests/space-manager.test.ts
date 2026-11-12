import { afterAll, beforeAll, describe, expect, expectTypeOf, it } from 'vitest'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import type { Client } from '@atproto/lex-client'
import { l } from '@atproto/lex-schema'
import type { SpaceRefString } from '@atproto/syntax'
import { createDidResolver } from '@atproto-labs/did-resolver'
import {
  type AtprotoDidResolver,
  type BaselineSpacePolicyManager,
  ManagedspacePolicyManager,
  MemberspacePolicyManager,
  PersonalspacePolicyManager,
  SpaceClient,
  SpaceManager,
  type SpacePolicy,
  SpacePolicyManager,
  UnsupportedSpacePolicyError,
  baselineSpacePolicies,
  managedspace,
  memberspace,
  personalspace,
} from '../src/index.js'
import {
  repoRemoved,
  repoWrite,
} from '../src/lexicons/com/atproto/space/defs.js'
import { agentOf, collect, createUser, processNotifications } from './_util.js'

const note = l.record(
  'tid',
  'com.example.spaceNote',
  l.object({ text: l.string() }),
)

const group = l.space('any', 'com.example.group', [note.$type], {
  title: 'Example group',
})

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

  async function create(
    skey: string,
    policy: SpacePolicy,
  ): Promise<SpaceRefString> {
    const space = await SpaceClient.createSpace(alice.agent, group, {
      skey,
      policy,
    })
    return space.uri
  }

  describe('baseline policies', () => {
    it('manages the member list of a memberspace', async () => {
      const uri = await create('members', memberspace.policy.$build({}))
      const manager = await SpaceManager.open(alice.agent, uri)
      expectTypeOf(manager).toEqualTypeOf<BaselineSpacePolicyManager>()

      expect(manager).toBeInstanceOf(MemberspacePolicyManager)
      if (!(manager instanceof MemberspacePolicyManager)) return
      expectTypeOf(manager.type).toEqualTypeOf<memberspace.policy.$type>()
      expect(manager.type).toBe(memberspace.policy.$type)

      await manager.putMembers([
        { did: bob.assertDid, read: true, write: false },
      ])
      const { members } = await manager.listMembers()
      expect(members).toEqual([
        { did: bob.assertDid, read: true, write: false },
      ])

      await manager.removeMembers([bob.assertDid])
      expect(await collect(manager.members())).toEqual([])
    })

    it('updates the configuration of the policy', async () => {
      const uri = await create('config', memberspace.policy.$build({}))
      const manager = await SpaceManager.open(alice.agent, uri, {
        policies: [MemberspacePolicyManager],
      })
      expectTypeOf(manager).toEqualTypeOf<MemberspacePolicyManager>()

      await manager.updatePolicy({ publicRead: true })
      expect(manager.policy).toMatchObject({ publicRead: true })

      await manager.updatePolicy(({ allowedApps = [] }) => ({
        allowedApps: [...allowedApps, 'https://app.example/client.json'],
      }))
      const { policy } = await new SpaceManager(agentOf(alice), uri).getSpace()
      expect(policy).toMatchObject({
        $type: memberspace.policy.$type,
        allowedApps: ['https://app.example/client.json'],
      })
    })

    it('manages a personalspace', async () => {
      const uri = await create('personal', personalspace.policy.$build({}))
      const manager = await SpaceManager.open(alice.agent, uri)
      expect(manager).toBeInstanceOf(PersonalspacePolicyManager)
      expect(manager.policy).toEqual(personalspace.policy.$build({}))
    })

    it('refuses policies other than the expected ones', async () => {
      const uri = await create('unexpected', personalspace.policy.$build({}))
      const result = SpaceManager.open(alice.agent, uri, {
        policies: [MemberspacePolicyManager],
      })
      await expect(result).rejects.toBeInstanceOf(UnsupportedSpacePolicyError)
      await expect(result).rejects.toMatchObject({
        policy: { $type: personalspace.policy.$type },
      })
    })
  })

  describe('other managers', () => {
    class AuditedPolicyManager extends SpacePolicyManager<memberspace.policy.Main> {
      static readonly schema = memberspace.policy.main

      isPublic(): boolean {
        return this.policy.publicRead === true
      }
    }

    it('manages a space with the first matching manager', async () => {
      const uri = await create('audited', memberspace.policy.$build({}))
      const manager = await SpaceManager.open(alice.agent, uri, {
        policies: [AuditedPolicyManager, ...baselineSpacePolicies],
      })
      expectTypeOf(manager).toEqualTypeOf<
        AuditedPolicyManager | BaselineSpacePolicyManager
      >()
      expect(manager).toBeInstanceOf(AuditedPolicyManager)
      if (!(manager instanceof AuditedPolicyManager)) return
      expect(manager.isPublic()).toBe(false)

      await manager.updatePolicy({ publicRead: true })
      expect(manager.isPublic()).toBe(true)
    })
  })

  describe('lifecycle', () => {
    it('governs a space by another policy', async () => {
      const uri = await create('migrated', memberspace.policy.$build({}))
      const space = new SpaceManager(agentOf(alice), uri)

      await space.updateSpace(
        managedspace.policy.$build({
          managingApp: 'did:web:app.example#forum',
        }),
      )
      const manager = await space.managePolicy()
      expect(manager).toBeInstanceOf(ManagedspacePolicyManager)
      expect(manager.policy).toMatchObject({
        managingApp: 'did:web:app.example#forum',
      })
    })

    it('removes writers from the writer set', async () => {
      const uri = await create('writers', memberspace.policy.$build({}))
      const manager = await SpaceManager.open(alice.agent, uri, {
        policies: [MemberspacePolicyManager],
      })
      await manager.putMembers([
        { did: bob.assertDid, read: true, write: true },
      ])

      const bobSpace = SpaceClient.openSpace(group, uri, {
        agent: bob.agent,
        didResolver,
      })
      await bobSpace.create(note, { text: 'from bob' })
      await processNotifications(network)

      const aliceSpace = SpaceClient.openSpace(group, uri, {
        agent: alice.agent,
        didResolver,
      })
      const bobWriter = async () =>
        (await collect(aliceSpace.writers())).findLast(
          (r) => r.repo === bob.assertDid,
        )
      expect((await bobWriter())?.$type).toBe(repoWrite.$type)

      // Still listed after removal, so that syncers learn of it.
      await new SpaceManager(agentOf(alice), uri).removeWriter(bob.assertDid)
      expect((await bobWriter())?.$type).toBe(repoRemoved.$type)

      // But no longer part of the space.
      const records = await collect(aliceSpace.allRecords())
      expect(records.map((r) => r.repo)).not.toContain(bob.assertDid)
    })

    it('deletes a space', async () => {
      const uri = await create('deleted', memberspace.policy.$build({}))
      const space = new SpaceManager(agentOf(alice), uri)
      await space.deleteSpace()
      await expect(space.getSpace()).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
    })

    it('can only be managed by the space authority', async () => {
      const uri = await create('authority', memberspace.policy.$build({}))
      expect(() => new SpaceManager(agentOf(bob), uri)).toThrow(TypeError)
      await expect(SpaceManager.open(bob.agent, uri)).rejects.toThrow(TypeError)
    })
  })
})
