import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { forSnapshot } from './_util'

describe('team management', () => {
  let network: TestNetwork
  let adminAgent: AtpAgent
  let triageAgent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_team_test',
    })
    adminAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()

    await network.ozone.addAdminDid(sc.dids.alice)
    await network.ozone.addModeratorDid(sc.dids.bob)
    await network.ozone.addTriageDid(sc.dids.carol)
    await adminAgent.login({
      identifier: sc.accounts[sc.dids.alice].handle,
      password: sc.accounts[sc.dids.alice].password,
    })
    triageAgent = network.pds.getClient()
    await triageAgent.login({
      identifier: sc.accounts[sc.dids.carol].handle,
      password: sc.accounts[sc.dids.carol].password,
    })
  })

  afterAll(async () => {
    await network.close()
  })

  describe('listMembers', () => {
    it('allows all members to list all members', async () => {
      const [{ data: forAdmin }, { data: forTriage }] = await Promise.all([
        adminAgent.api.tools.ozone.team.listMembers({}),
        triageAgent.api.tools.ozone.team.listMembers({}),
      ])
      expect(forSnapshot(forAdmin.members)).toMatchSnapshot()
      expect(forSnapshot(forTriage.members)).toMatchSnapshot()
      // Validate that the list looks the same to both admin and triage members

      expect(forAdmin.members.length).toEqual(forTriage.members.length)
    })
  })
  describe('listMembers', () => {
    it('allows all members to list all members', async () => {
      const [{ data: forAdmin }, { data: forTriage }] = await Promise.all([
        adminAgent.api.tools.ozone.team.listMembers({}),
        triageAgent.api.tools.ozone.team.listMembers({}),
      ])
      expect(forSnapshot(forAdmin.members)).toMatchSnapshot()
      expect(forSnapshot(forTriage.members)).toMatchSnapshot()
      // Validate that the list looks the same to both admin and triage members

      expect(forAdmin.members.length).toEqual(forTriage.members.length)
    })
  })
  describe('addMember', () => {
    const newMemberData = {
      did: 'did:plc:newMember',
      role: 'tools.ozone.team.defs#roleAdmin',
      disabled: false,
    }
    it('only allows admins to add member', async () => {
      await expect(
        triageAgent.api.tools.ozone.team.addMember(newMemberData),
      ).rejects.toThrow('Must be an admin to add a member')
      const { data: newMember } =
        await adminAgent.api.tools.ozone.team.addMember(newMemberData)
      expect(forSnapshot(newMember)).toMatchSnapshot()
    })
    it('throws error when trying to add existing member', async () => {
      await expect(
        adminAgent.api.tools.ozone.team.addMember(newMemberData),
      ).rejects.toThrow('member already exists')
    })
  })
  describe('deleteMember', () => {
    it('only allows admins to delete members', async () => {
      const {
        data: { members: initialMembers },
      } = await adminAgent.api.tools.ozone.team.listMembers({})
      await expect(
        triageAgent.api.tools.ozone.team.deleteMember({
          did: sc.dids.bob,
        }),
      ).rejects.toThrow('Must be an admin to delete a member')

      await adminAgent.api.tools.ozone.team.deleteMember({
        did: sc.dids.bob,
      })
      const {
        data: { members: membersAfterDelete },
      } = await adminAgent.api.tools.ozone.team.listMembers({})

      expect(membersAfterDelete.length).toEqual(initialMembers.length - 1)
      expect(membersAfterDelete.map(({ did }) => did)).not.toContain(
        sc.dids.bob,
      )
    })

    it('throws error when trying to remove non-existent member', async () => {
      await expect(
        adminAgent.api.tools.ozone.team.deleteMember({
          did: 'did:plc:test',
        }),
      ).rejects.toThrow('member not found')
    })
  })
  describe('updateMember', () => {
    it('allows admins to update member', async () => {
      const getCarol = async () => {
        const {
          data: { members },
        } = await adminAgent.api.tools.ozone.team.listMembers({})

        return members.find(({ did }) => did === sc.dids.carol)
      }
      await expect(
        triageAgent.api.tools.ozone.team.updateMember({
          disabled: false,
          did: sc.dids.carol,
          role: 'tools.ozone.team.defs#roleAdmin',
        }),
      ).rejects.toThrow('Must be an admin to update a member')

      await adminAgent.api.tools.ozone.team.updateMember({
        did: sc.dids.carol,
        role: 'tools.ozone.team.defs#roleAdmin',
      })
      const carolAfterRoleChange = await getCarol()
      expect(carolAfterRoleChange?.role).toEqual(
        'tools.ozone.team.defs#roleAdmin',
      )
      // Verify that params that we didn't send did not get updated
      expect(carolAfterRoleChange?.disabled).toEqual(false)

      await adminAgent.api.tools.ozone.team.updateMember({
        did: sc.dids.carol,
        disabled: true,
      })
      const carolAfterDisable = await getCarol()
      expect(carolAfterDisable?.disabled).toEqual(true)
      // Verify that params that we didn't send did not get updated
      expect(carolAfterDisable?.role).toEqual('tools.ozone.team.defs#roleAdmin')
    })
    it('throws error when trying to update non-existent member', async () => {
      await expect(
        adminAgent.api.tools.ozone.team.updateMember({
          disabled: false,
          did: 'did:plc:test',
          role: 'tools.ozone.team.defs#roleAdmin',
        }),
      ).rejects.toThrow('member not found')
    })
  })
})
