import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import {
  ROLEADMIN,
  ROLEMODERATOR,
} from '../dist/lexicon/types/tools/ozone/team/defs'
import { ProtectedTagSettingKey } from '../src/setting/constants'

describe('protected-tags', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient
  const basicSetting = {
    key: ProtectedTagSettingKey,
    scope: 'instance',
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_protected_tags',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  describe('Settings management', () => {
    it('validates settings', async () => {
      await expect(
        modClient.upsertSettingOption({
          ...basicSetting,
          managerRole: ROLEMODERATOR,
          value: {
            vip: {},
          },
        }),
      ).rejects.toThrow(
        'Only admins should be able to configure protected tags',
      )
      await expect(
        modClient.upsertSettingOption({
          ...basicSetting,
          managerRole: ROLEADMIN,
          // @ts-expect-error testing invalid value here
          value: ['test'],
        }),
      ).rejects.toThrow('Invalid configuration')
      await expect(
        modClient.upsertSettingOption({
          ...basicSetting,
          managerRole: ROLEADMIN,
          value: { vip: 'test' },
        }),
      ).rejects.toThrow('Invalid configuration')
      await expect(
        modClient.upsertSettingOption({
          ...basicSetting,
          managerRole: ROLEADMIN,
          value: { vip: { weirdValue: 1 } },
        }),
      ).rejects.toThrow(/Must define who a list of moderators or a role/gi)
      await expect(
        modClient.upsertSettingOption({
          ...basicSetting,
          managerRole: ROLEADMIN,
          value: { vip: { roles: 'test' } },
        }),
      ).rejects.toThrow(/Roles must be an array of moderator/gi)
      await expect(
        modClient.upsertSettingOption({
          ...basicSetting,
          managerRole: ROLEADMIN,
          value: { vip: { roles: 'test' } },
        }),
      ).rejects.toThrow(/Roles must be an array of moderator/gi)
      await expect(
        modClient.upsertSettingOption({
          ...basicSetting,
          managerRole: ROLEADMIN,
          value: { vip: { moderators: 1 } },
        }),
      ).rejects.toThrow(/Moderators must be an array of moderator/gi)
    })
  })
  describe('Protected subject via tags', () => {
    afterEach(async () => {
      await modClient.removeSettingOptions({
        keys: [ProtectedTagSettingKey],
        scope: 'instance',
      })
    })
    it('only allows configured roles to add/remove protected tags', async () => {
      await modClient.upsertSettingOption({
        ...basicSetting,
        managerRole: ROLEADMIN,
        value: { vip: { roles: ['tools.ozone.team.defs#roleAdmin'] } },
      })

      await expect(
        modClient.emitEvent({
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.bob,
          },
          event: {
            $type: 'tools.ozone.moderation.defs#modEventTag',
            add: ['vip'],
            remove: [],
          },
        }),
      ).rejects.toThrow(/Can not manage tag vip/gi)

      await modClient.emitEvent(
        {
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.bob,
          },
          event: {
            $type: 'tools.ozone.moderation.defs#modEventTag',
            add: ['vip'],
            remove: [],
          },
        },
        'admin',
      )
      await expect(
        modClient.emitEvent({
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.bob,
          },
          event: {
            $type: 'tools.ozone.moderation.defs#modEventTag',
            add: [],
            remove: ['vip'],
          },
        }),
      ).rejects.toThrow(/Can not manage tag vip/gi)

      // Verify that since admins are configured to manage this tag, admin actions go through
      const removeTag = await modClient.emitEvent(
        {
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.bob,
          },
          event: {
            $type: 'tools.ozone.moderation.defs#modEventTakedown',
          },
        },
        'admin',
      )

      expect(removeTag.id).toBeTruthy()
    })
    it('only allows configured moderators to add/remove protected tags', async () => {
      await modClient.upsertSettingOption({
        ...basicSetting,
        managerRole: ROLEADMIN,
        value: { vip: { moderators: [network.ozone.adminAccnt.did] } },
      })

      // By default, this query is made with moderator account's did
      await expect(
        modClient.emitEvent({
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.bob,
          },
          event: {
            $type: 'tools.ozone.moderation.defs#modEventTag',
            add: ['vip'],
            remove: [],
          },
        }),
      ).rejects.toThrow(/Not allowed to manage tag: vip/gi)

      await modClient.emitEvent(
        {
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.bob,
          },
          event: {
            $type: 'tools.ozone.moderation.defs#modEventTag',
            add: ['vip'],
            remove: [],
          },
        },
        'admin',
      )

      await expect(
        modClient.emitEvent({
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.bob,
          },
          event: {
            $type: 'tools.ozone.moderation.defs#modEventTag',
            add: [],
            remove: ['vip'],
          },
        }),
      ).rejects.toThrow(/Not allowed to manage tag: vip/gi)
    })
  })
})
