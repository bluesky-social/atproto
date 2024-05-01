import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import { forSnapshot } from './_util'

describe('moderator management', () => {
  let network: TestNetwork
  let adminAgent: AtpAgent
  let triageAgent: AtpAgent
  let ozone: AtpAgent
  let sc: SeedClient
  let modClient: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_moderator_test',
    })
    adminAgent = network.pds.getClient()
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    ozone = network.ozone.getClient()
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
      expect(forSnapshot(forAdmin)).toMatchSnapshot()
      expect(forSnapshot(forTriage)).toMatchSnapshot()
      // Validate that the list looks the same to both admin and triage mods
      expect(forAdmin.users.length).toEqual(forTriage.users.length)
    })
  })
  describe('deleteUser', () => {
    it('only allows admins to delete users', async () => {
      await expect(
        triageAgent.api.tools.ozone.moderator.deleteUser({
          did: sc.dids.bob,
        }),
      ).rejects.toThrow('Must be an admin to delete a moderator user')

      await adminAgent.api.tools.ozone.moderator.deleteUser({
        did: sc.dids.bob,
      })
      const {
        data: { users },
      } = await adminAgent.api.tools.ozone.moderator.listUsers({})

      expect(users.length).toEqual(2)
      expect(users.map(({ did }) => did)).not.toContain(sc.dids.bob)
    })

    it('throws error when trying to remove non-existent user', async () => {
      await expect(
        adminAgent.api.tools.ozone.moderator.deleteUser({
          did: 'did:plc:test',
        }),
      ).rejects.toThrow('moderator not found')
    })
    it('throws error when trying to remove the last admin user', async () => {
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
          role: 'tools.ozone.moderator.updateUser#modRoleAdmin',
        }),
      ).rejects.toThrow('Must be an admin to update a moderator user')

      await adminAgent.api.tools.ozone.moderator.updateUser({
        disabled: true,
        did: sc.dids.carol,
        role: 'tools.ozone.moderator.updateUser#modRoleAdmin',
      })
      const {
        data: { users },
      } = await adminAgent.api.tools.ozone.moderator.listUsers({})

      expect(users.find(({ did }) => did === sc.dids.carol)?.role).toEqual(
        'tools.ozone.moderator.updateUser#modRoleAdmin',
      )
    })
    it('throws error when trying to update non-existent user', async () => {
      await expect(
        adminAgent.api.tools.ozone.moderator.updateUser({
          disabled: false,
          did: 'did:plc:test',
          role: 'tools.ozone.moderator.updateUser#modRoleAdmin',
        }),
      ).rejects.toThrow('moderator not found')
    })
  })
})
