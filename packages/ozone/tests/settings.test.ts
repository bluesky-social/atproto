import { ids } from '@atproto/api'
import type {
  ToolsOzoneSettingListOptions,
  ToolsOzoneSettingUpsertOption,
} from '@atproto/api'
import type AtpAgent from '@atproto/api'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import type { SettingScope } from '../dist/db/schema/setting.js'
import { com, tools } from '../src/lexicons/index.js'
import {
  PriorityLevelSettingKey,
  ReportPriorityLevelSettingKey,
} from '../src/setting/constants.js'
import { forSnapshot } from './_util.js'

describe('ozone-settings', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  const upsertOption = async (
    setting: ToolsOzoneSettingUpsertOption.InputSchema,
    callerRole: 'admin' | 'moderator' | 'triage' = 'admin',
  ) => {
    const { data } = await agent.tools.ozone.setting.upsertOption(setting, {
      encoding: 'application/json',
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneSettingUpsertOption,
        callerRole,
      ),
    })

    return data
  }

  const removeOptions = async (
    keys: string[],
    scope: SettingScope,
    callerRole: 'admin' | 'moderator' | 'triage' = 'admin',
  ) => {
    await agent.tools.ozone.setting.removeOptions(
      { keys, scope },
      {
        encoding: 'application/json',
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneSettingRemoveOptions,
          callerRole,
        ),
      },
    )
  }

  const listOptions = async (
    params: ToolsOzoneSettingListOptions.QueryParams,
    callerRole: 'admin' | 'moderator' | 'triage' = 'moderator',
  ) => {
    const { data } = await agent.tools.ozone.setting.listOptions(params, {
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneSettingListOptions,
        callerRole,
      ),
    })
    return data
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_settings',
    })
    agent = network.ozone.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
  })

  describe('upsertOption', () => {
    afterAll(async () => {
      await removeOptions(
        ['tools.ozone.setting.upsertTest.labelers'],
        'personal',
      )
    })
    it('only allows managerRole to update instance settings', async () => {
      await upsertOption({
        scope: 'instance',
        key: 'tools.ozone.setting.upsertTest.labelers',
        value: { dids: ['did:plc:xyz'] },
        description: 'triage users can not update this',
        managerRole: 'tools.ozone.team.defs#roleModerator',
      })

      await expect(
        upsertOption(
          {
            scope: 'instance',
            key: 'tools.ozone.setting.upsertTest.labelers',
            value: { noDids: 'test' },
            description: 'triage users can not update this',
            managerRole: 'tools.ozone.team.defs#roleModerator',
          },
          'triage',
        ),
      ).rejects.toThrow(/Not permitted/gi)

      await upsertOption(
        {
          scope: 'instance',
          key: 'tools.ozone.setting.upsertTest.labelers',
          value: { noDids: 'test' },
          description:
            'My personal labelers that i want to use when browsing ozone',
          managerRole: 'tools.ozone.team.defs#roleModerator',
        },
        'moderator',
      )

      const afterUpdatedByModerator = await listOptions(
        {
          scope: 'instance',
          prefix: 'tools.ozone.setting.upsertTest.labelers',
        },
        'moderator',
      )
      expect(afterUpdatedByModerator.options[0].value?.['dids']).toBeFalsy()
      expect(afterUpdatedByModerator.options[0].value?.['noDids']).toEqual(
        'test',
      )
      await upsertOption(
        {
          scope: 'instance',
          key: 'tools.ozone.setting.upsertTest.labelers',
          value: { dids: 'test' },
          description:
            'My personal labelers that i want to use when browsing ozone',
          managerRole: 'tools.ozone.team.defs#roleModerator',
        },
        'moderator',
      )

      const afterUpdatedByAdmin = await listOptions(
        {
          scope: 'instance',
          prefix: 'tools.ozone.setting.upsertTest.labelers',
        },
        'admin',
      )
      expect(afterUpdatedByAdmin.options[0].value?.['noDids']).toBeFalsy()
      expect(afterUpdatedByAdmin.options[0].value?.['dids']).toEqual('test')
    })
  })

  describe('report priority settings', () => {
    const levelsKey = PriorityLevelSettingKey
    const mappingsKey = ReportPriorityLevelSettingKey
    const reason = com.atproto.moderation.defs.ReasonSpam
    const level = { name: 'Urgent', targetResolutionMinutes: 720, score: 100 }
    const setting = (key: string, value: Record<string, unknown>) => ({
      scope: 'instance',
      key,
      value,
      managerRole: tools.ozone.team.defs.RoleAdmin,
    })

    beforeEach(async () => removeOptions([levelsKey, mappingsKey], 'instance'))
    afterAll(async () => removeOptions([levelsKey, mappingsKey], 'instance'))

    it.each(['moderator', 'triage'] as const)(
      'only admins can create, update, or delete priorities (%s)',
      async (role) => {
        for (const key of [levelsKey, mappingsKey]) {
          await expect(upsertOption(setting(key, {}), role)).rejects.toThrow(
            'Only admins',
          )
          await upsertOption(setting(key, {}))
          await expect(upsertOption(setting(key, {}), role)).rejects.toThrow(
            'Only admins',
          )
          await expect(removeOptions([key], 'instance', role)).rejects.toThrow(
            'Only admins',
          )
        }
        expect(
          (
            await listOptions({
              keys: [levelsKey, mappingsKey],
              scope: 'instance',
            })
          ).options,
        ).toHaveLength(2)
      },
    )

    it('rejects personal scope', async () => {
      for (const key of [levelsKey, mappingsKey]) {
        await expect(
          upsertOption({ ...setting(key, {}), scope: 'personal' }),
        ).rejects.toThrow('instance scope')
        await expect(removeOptions([key], 'personal')).rejects.toThrow(
          'instance scope',
        )
      }
    })

    it('requires an admin manager role on creation and update', async () => {
      for (const key of [levelsKey, mappingsKey]) {
        for (const managerRole of [
          undefined,
          tools.ozone.team.defs.RoleModerator,
          tools.ozone.team.defs.RoleTriage,
          tools.ozone.team.defs.RoleVerifier,
        ]) {
          await expect(
            upsertOption({ ...setting(key, {}), managerRole }),
          ).rejects.toThrow('must have an admin managerRole')
        }

        await upsertOption(setting(key, {}))
        await expect(
          upsertOption({ ...setting(key, {}), managerRole: undefined }),
        ).rejects.toThrow('must have an admin managerRole')
        await expect(
          upsertOption({
            ...setting(key, {}),
            managerRole: tools.ozone.team.defs.RoleModerator,
          }),
        ).rejects.toThrow('must have an admin managerRole')
      }
      const { options } = await listOptions({
        scope: 'instance',
        keys: [levelsKey, mappingsKey],
      })
      expect(options.map((option) => option.managerRole)).toEqual([
        tools.ozone.team.defs.RoleAdmin,
        tools.ozone.team.defs.RoleAdmin,
      ])
    })

    it.each([
      [{ ' ': level }, /Invalid priority level/],
      [{ ' padded ': level }, /Invalid priority level/],
      [{ urgent: null }, /Invalid priority level/],
      [{ urgent: { ...level, name: '' } }, /name/],
      [{ urgent: { ...level, name: 12 } }, /name/],
      [{ urgent: { ...level, score: -1 } }, /integer score/],
      [{ urgent: { ...level, score: 101 } }, /integer score/],
      [{ urgent: { ...level, score: 1.5 } }, /integer/],
      [{ urgent: { ...level, score: '50' } }, /integer score/],
      [{ urgent: level, normal: level }, /unique/],
      [
        { urgent: { ...level, targetResolutionMinutes: 0 } },
        /positive integer/,
      ],
      [{ urgent: { ...level, targetResolutionMinutes: 0.5 } }, /integer/],
      [
        { urgent: { ...level, targetResolutionMinutes: '720' } },
        /positive integer/,
      ],
      [
        { urgent: { ...level, targetResolutionMinutes: 2_147_483_648 } },
        /positive integer/,
      ],
    ])('rejects invalid level definitions (%#)', async (value, message) => {
      await expect(upsertOption(setting(levelsKey, value))).rejects.toThrow(
        message,
      )
    })

    it('accepts empty and partial configuration and boundary values', async () => {
      await upsertOption(setting(mappingsKey, {}))
      await expect(
        upsertOption(setting(mappingsKey, { [reason]: 'urgent' })),
      ).rejects.toThrow('Unknown priority levels')
      await upsertOption(
        setting(levelsKey, {
          urgent: { ...level, targetResolutionMinutes: 1 },
          low: { ...level, score: 0, targetResolutionMinutes: 2_147_483_647 },
        }),
      )
      await upsertOption(
        setting(mappingsKey, {
          [reason]: 'urgent',
          [com.atproto.moderation.defs.ReasonOther]: 'urgent',
        }),
      )
      await upsertOption(setting(mappingsKey, {}))
      await upsertOption(setting(levelsKey, {}))
    })

    it.each([
      { '': 'urgent' },
      { [reason]: '' },
      { [reason]: 100 },
      { [reason]: 'missing' },
      { [reason]: 'constructor' },
      { [reason]: '__proto__' },
    ])('rejects invalid reason mappings (%#)', async (value) => {
      await upsertOption(setting(levelsKey, { urgent: level }))
      await expect(upsertOption(setting(mappingsKey, value))).rejects.toThrow(
        /Invalid priority mapping|Unknown priority levels/,
      )
    })

    it('requires removing references before deleting or renaming a level', async () => {
      await upsertOption(setting(levelsKey, { urgent: level }))
      await upsertOption(setting(mappingsKey, { [reason]: 'urgent' }))
      await expect(upsertOption(setting(levelsKey, {}))).rejects.toThrow(
        'Unknown priority levels',
      )
      await expect(
        upsertOption(setting(levelsKey, { renamed: level })),
      ).rejects.toThrow('Unknown priority levels')
      await expect(removeOptions([levelsKey], 'instance')).rejects.toThrow(
        'Remove report priority',
      )
      await removeOptions([mappingsKey], 'instance')
      await removeOptions([levelsKey], 'instance')
      expect(
        (
          await listOptions({
            scope: 'instance',
            keys: [levelsKey, mappingsKey],
          })
        ).options,
      ).toHaveLength(0)
    })
  })

  describe('listOptions', () => {
    beforeAll(async () => {
      await upsertOption({
        scope: 'instance',
        key: 'tools.ozone.setting.client.queues',
        value: { stratosphere: { name: 'Stratosphere' } },
        description:
          'This determines how many queues the client interface will show',
        managerRole: 'tools.ozone.team.defs#roleAdmin',
      })
      await upsertOption({
        scope: 'instance',
        key: 'tools.ozone.setting.client.queueHash',
        value: { val: 10 },
        description:
          'This determines how each queue is balanced when sorted by oldest first',
        managerRole: 'tools.ozone.team.defs#roleAdmin',
      })
      await upsertOption({
        scope: 'instance',
        key: 'tools.ozone.setting.client.externalLabelers',
        value: { dids: ['did:plc:xyz'] },
        description:
          'List of external labelers that will be plugged into the client views',
        managerRole: 'tools.ozone.team.defs#roleAdmin',
      })
    })

    afterAll(async () => {
      await removeOptions(
        [
          'tools.ozone.setting.client.queues',
          'tools.ozone.setting.client.queueHash',
          'tools.ozone.setting.client.externalLabelers',
        ],
        'instance',
      )
    })

    it('returns all personal settings', async () => {
      const result = await listOptions({ prefix: 'tools.ozone.setting.client' })
      expect(result.options.length).toBe(3)

      expect(forSnapshot(result.options)).toMatchSnapshot()
    })

    it('allows paginating options', async () => {
      const params = { prefix: 'tools.ozone.setting.client', limit: 1 }
      const pageOne = await listOptions(params)
      const pageTwo = await listOptions({
        ...params,
        cursor: pageOne.cursor,
      })
      const pageThree = await listOptions({
        ...params,
        cursor: pageTwo.cursor,
      })
      const pageFour = await listOptions({
        ...params,
        cursor: pageThree.cursor,
      })

      expect(pageFour.options.length).toBe(0)
      expect(pageFour.cursor).toBeUndefined()
    })
  })

  describe('removeOptions', () => {
    afterAll(async () => {
      await Promise.all([
        removeOptions(['tools.ozone.setting.personal.labelers'], 'personal'),
        removeOptions(
          ['tools.ozone.setting.only.mod', 'tools.ozone.setting.only.admin'],
          'instance',
        ),
      ])
    })

    it('only allows the owner to delete personal setting', async () => {
      await upsertOption({
        scope: 'personal',
        key: 'tools.ozone.setting.personal.labelers',
        value: { dids: ['did:plc:xyz'] },
        description:
          'My personal labelers that i want to use when browsing ozone',
        managerRole: 'tools.ozone.team.defs#roleOwner',
      })

      // one user can't remove personal setting of another
      await removeOptions(
        ['tools.ozone.setting.personal.labelers'],
        'personal',
        'triage',
      )
      const list = await listOptions({ scope: 'personal' }, 'admin')
      expect(list.options.length).toBe(1)

      // the owner of the personal setting can remove their own setting
      await removeOptions(['tools.ozone.setting.personal.labelers'], 'personal')
      const listAfterRemoval = await listOptions({ scope: 'personal' }, 'admin')
      expect(listAfterRemoval.options.length).toBe(0)
    })

    it('only allows managerRole to delete instance setting', async () => {
      await Promise.all([
        upsertOption({
          scope: 'instance',
          key: 'tools.ozone.setting.only.mod',
          value: { dids: ['did:plc:xyz'] },
          description: 'Triage mods can not manage these',
          managerRole: 'tools.ozone.team.defs#roleModerator',
        }),
        upsertOption({
          scope: 'instance',
          key: 'tools.ozone.setting.only.admin',
          value: { dids: ['did:plc:xyz'] },
          description: 'Moderators or triage mods can not manage these',
          managerRole: 'tools.ozone.team.defs#roleAdmin',
        }),
      ])

      await Promise.all([
        removeOptions(['tools.ozone.setting.only.mod'], 'instance', 'triage'),
        removeOptions(
          ['tools.ozone.setting.only.admin'],
          'instance',
          'moderator',
        ),
        removeOptions(['tools.ozone.setting.only.admin'], 'instance', 'triage'),
      ])

      const afterFailedAttempt = await listOptions(
        { scope: 'instance', prefix: 'tools.ozone.setting.only' },
        'admin',
      )
      const keysAfterFailedAttempt = afterFailedAttempt.options.map(
        (o) => o.key,
      )

      const keys = [
        'tools.ozone.setting.only.mod',
        'tools.ozone.setting.only.admin',
      ]

      keys.forEach((key) => expect(keysAfterFailedAttempt).toContain(key))

      await Promise.all([
        removeOptions(['tools.ozone.setting.only.mod'], 'instance', 'admin'),
        removeOptions(['tools.ozone.setting.only.admin'], 'instance', 'admin'),
      ])

      const afterRemoval = await listOptions(
        { scope: 'instance', prefix: 'tools.ozone.setting.only' },
        'admin',
      )
      expect(afterRemoval.options.length).toBe(0)
    })
  })
})
