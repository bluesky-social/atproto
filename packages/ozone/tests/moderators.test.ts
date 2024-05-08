import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import { forSnapshot } from './_util'

describe('moderator management', () => {
  let network: TestNetwork
  let adminAgent: AtpAgent
  let triageAgent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_moderator_test',
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

  describe('listUsers', () => {
    it('allows all mods to list all users', async () => {
      const [{ data: forAdmin }, { data: forTriage }] = await Promise.all([
        adminAgent.api.tools.ozone.moderator.listUsers({}),
        (async () => {
          return triageAgent.api.tools.ozone.moderator.listUsers({})
        })(),
      ])
      expect(forSnapshot(forAdmin.users)).toMatchSnapshot()
      expect(forSnapshot(forTriage.users)).toMatchSnapshot()
      // Validate that the list looks the same to both admin and triage mods

      expect(forAdmin.users.length).toEqual(forTriage.users.length)
    })
  })
  describe('deleteUser', () => {
    it('only allows admins to delete users', async () => {
      const {
        data: { users: initialUsers },
      } = await adminAgent.api.tools.ozone.moderator.listUsers({})
      await expect(
        triageAgent.api.tools.ozone.moderator.deleteUser({
          did: sc.dids.bob,
        }),
      ).rejects.toThrow('Must be an admin to delete a moderator user')

      await adminAgent.api.tools.ozone.moderator.deleteUser({
        did: sc.dids.bob,
      })
      const {
        data: { users: usersAfterDelete },
      } = await adminAgent.api.tools.ozone.moderator.listUsers({})

      expect(usersAfterDelete.length).toEqual(initialUsers.length - 1)
      expect(usersAfterDelete.map(({ did }) => did)).not.toContain(sc.dids.bob)
    })

    it('throws error when trying to remove non-existent user', async () => {
      await expect(
        adminAgent.api.tools.ozone.moderator.deleteUser({
          did: 'did:plc:test',
        }),
      ).rejects.toThrow('moderator not found')
    })
    it('throws error when trying to remove the last admin user', async () => {
      const {
        data: { users },
      } = await adminAgent.api.tools.ozone.moderator.listUsers({})
      const didsToBeRemoved: string[] = []
      users.forEach(({ did, role }) => {
        if (role.includes('Admin') && did !== sc.dids.alice) {
          didsToBeRemoved.push(did)
        }
      })

      // Remove all admins and leave only one
      await Promise.all(
        didsToBeRemoved.map((did) => {
          return network.ozone.ctx
            .moderatorService(network.ozone.ctx.db)
            .delete(did)
        }),
      )

      await expect(
        adminAgent.api.tools.ozone.moderator.deleteUser({
          did: sc.dids.alice,
        }),
      ).rejects.toThrow('last admin')
    })
  })
  describe('updateUser', () => {
    it('allows admins to update user', async () => {
      await expect(
        triageAgent.api.tools.ozone.moderator.updateUser({
          disabled: false,
          did: sc.dids.carol,
          role: 'tools.ozone.moderator.defs#modRoleAdmin',
        }),
      ).rejects.toThrow('Must be an admin to update a moderator user')

      await adminAgent.api.tools.ozone.moderator.updateUser({
        disabled: true,
        did: sc.dids.carol,
        role: 'tools.ozone.moderator.defs#modRoleAdmin',
      })
      const {
        data: { users },
      } = await adminAgent.api.tools.ozone.moderator.listUsers({})

      expect(users.find(({ did }) => did === sc.dids.carol)?.role).toEqual(
        'tools.ozone.moderator.defs#modRoleAdmin',
      )
    })
    it('throws error when trying to update non-existent user', async () => {
      await expect(
        adminAgent.api.tools.ozone.moderator.updateUser({
          disabled: false,
          did: 'did:plc:test',
          role: 'tools.ozone.moderator.defs#modRoleAdmin',
        }),
      ).rejects.toThrow('moderator not found')
    })
  })
})
