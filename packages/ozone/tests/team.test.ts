import { AtpAgent, ToolsOzoneTeamDefs } from '@atproto/api'
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
      ozone: {
        dbTeamProfileRefreshIntervalMs: 100,
      },
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
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  describe('listMembers', () => {
    it('allows all members to list all members', async () => {
      const [{ data: forAdmin }, { data: forTriage }] = await Promise.all([
        adminAgent.tools.ozone.team.listMembers({}),
        triageAgent.tools.ozone.team.listMembers({}),
      ])

      expect(forSnapshot(forAdmin.members)).toMatchSnapshot()
      expect(forSnapshot(forTriage.members)).toMatchSnapshot()
      // Validate that the list looks the same to both admin and triage members

      expect(forAdmin.members.length).toEqual(forTriage.members.length)
    })
    it('allows filtering members by role', async () => {
      const [{ data: onlyAdmins }, { data: onlyTriage }] = await Promise.all([
        adminAgent.tools.ozone.team.listMembers({
          roles: [ToolsOzoneTeamDefs.ROLEADMIN],
        }),
        adminAgent.tools.ozone.team.listMembers({
          roles: [ToolsOzoneTeamDefs.ROLETRIAGE],
        }),
      ])

      expect(
        onlyAdmins.members.find(
          ({ role }) => role !== ToolsOzoneTeamDefs.ROLEADMIN,
        ),
      ).toBeUndefined()

      expect(
        onlyTriage.members.find(
          ({ role }) => role !== ToolsOzoneTeamDefs.ROLETRIAGE,
        ),
      ).toBeUndefined()
    })
    it('allows filtering members by disabled status', async () => {
      const [{ data: onlyDisabled }, { data: onlyEnabled }] = await Promise.all(
        [
          adminAgent.tools.ozone.team.listMembers({
            disabled: true,
          }),
          adminAgent.tools.ozone.team.listMembers({
            disabled: false,
          }),
        ],
      )

      expect(
        onlyDisabled.members.find(({ disabled }) => !disabled),
      ).toBeUndefined()

      expect(
        onlyEnabled.members.find(({ disabled }) => disabled),
      ).toBeUndefined()
    })
    it('allows filtering members by handle/display name', async () => {
      const [{ data: matchingHandle }, { data: matchingName }] =
        await Promise.all([
          adminAgent.tools.ozone.team.listMembers({
            q: 'bob',
          }),
          adminAgent.tools.ozone.team.listMembers({
            q: 'dev',
          }),
        ])

      expect(matchingHandle.members.length).toEqual(1)
      expect(matchingHandle.members[0]?.profile?.handle).toEqual('bob.test')
      expect(matchingName.members.length).toEqual(1)
      expect(matchingName.members[0]?.profile?.handle).toEqual(
        'mod-authority.test',
      )
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
        triageAgent.tools.ozone.team.addMember(newMemberData),
      ).rejects.toThrow('Must be an admin to add a member')
      const { data: newMember } =
        await adminAgent.tools.ozone.team.addMember(newMemberData)
      expect(forSnapshot(newMember)).toMatchSnapshot()
    })
    it('throws error when trying to add existing member', async () => {
      await expect(
        adminAgent.tools.ozone.team.addMember(newMemberData),
      ).rejects.toThrow('member already exists')
    })
  })
  describe('deleteMember', () => {
    it('only allows admins to delete members', async () => {
      const {
        data: { members: initialMembers },
      } = await adminAgent.tools.ozone.team.listMembers({})
      await expect(
        triageAgent.tools.ozone.team.deleteMember({
          did: sc.dids.bob,
        }),
      ).rejects.toThrow('Must be an admin to delete a member')

      await adminAgent.tools.ozone.team.deleteMember({
        did: sc.dids.bob,
      })
      const {
        data: { members: membersAfterDelete },
      } = await adminAgent.tools.ozone.team.listMembers({})

      expect(membersAfterDelete.length).toEqual(initialMembers.length - 1)
      expect(membersAfterDelete.map(({ did }) => did)).not.toContain(
        sc.dids.bob,
      )
    })

    it('throws error when trying to remove non-existent member', async () => {
      await expect(
        adminAgent.tools.ozone.team.deleteMember({
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
        } = await adminAgent.tools.ozone.team.listMembers({})

        return members.find(({ did }) => did === sc.dids.carol)
      }
      await expect(
        triageAgent.tools.ozone.team.updateMember({
          disabled: false,
          did: sc.dids.carol,
          role: 'tools.ozone.team.defs#roleAdmin',
        }),
      ).rejects.toThrow('Must be an admin to update a member')

      await adminAgent.tools.ozone.team.updateMember({
        did: sc.dids.carol,
        role: 'tools.ozone.team.defs#roleAdmin',
      })
      const carolAfterRoleChange = await getCarol()
      expect(carolAfterRoleChange?.role).toEqual(
        'tools.ozone.team.defs#roleAdmin',
      )
      // Verify that params that we didn't send did not get updated
      expect(carolAfterRoleChange?.disabled).toEqual(false)

      await adminAgent.tools.ozone.team.updateMember({
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
        adminAgent.tools.ozone.team.updateMember({
          disabled: false,
          did: 'did:plc:test',
          role: 'tools.ozone.team.defs#roleAdmin',
        }),
      ).rejects.toThrow('member not found')
    })
  })
})
