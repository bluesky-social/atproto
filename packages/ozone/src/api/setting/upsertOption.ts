import { AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'
import { AdminTokenOutput, ModeratorOutput } from '../../auth-verifier'
import { SettingService } from '../../setting/service'
import { Member } from '../../db/schema/member'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.setting.upsertOption({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { key, value, description, managerRole, scope } = input.body
      const serviceDid = ctx.cfg.service.did
      let ownerDid = serviceDid

      if (scope === 'personal' && access.type !== 'moderator') {
        throw new AuthRequiredError(
          'Must use moderator auth to create or update a personal setting',
        )
      }

      // if the caller is using moderator auth and storing personal setting
      // use the caller's DID as the owner
      if (scope === 'personal' && access.type === 'moderator') {
        ownerDid = access.iss
      }

      const now = new Date()
      const baseOption = {
        key,
        value,
        did: ownerDid,
        createdBy: ownerDid,
        lastUpdatedBy: ownerDid,
        description: description || '',
        createdAt: now,
        updatedAt: now,
      }

      const settingService = ctx.settingService(db)
      if (scope === 'personal') {
        await settingService.upsert({
          ...baseOption,
          scope: 'personal',
          managerRole: null,
        })
      } else {
        const manageableRoles = getRolesForInstanceOption(access)
        const existingSetting = await settingService.query({
          scope: 'instance',
          keys: [key],
          limit: 1,
        })

        if (
          existingSetting.options[0]?.managerRole &&
          !manageableRoles.includes(existingSetting.options[0].managerRole)
        ) {
          throw new AuthRequiredError(`Not permitted to update setting ${key}`)
        }
        await settingService.upsert({
          ...baseOption,
          scope: 'instance',
          managerRole: getManagerRole(managerRole),
        })
      }

      const newOption = await getExistingSetting(settingService, key, scope)

      if (!newOption) {
        throw new Error('Failed to get the updated setting')
      }

      return {
        encoding: 'application/json',
        body: {
          option: settingService.view(newOption),
        },
      }
    },
  })
}

const getExistingSetting = async (
  settingService: SettingService,
  key: string,
  scope: string,
) => {
  const result = await settingService.query({
    scope: scope === 'personal' ? 'personal' : 'instance',
    keys: [key],
    limit: 1,
  })

  return result.options[0]
}

const getRolesForInstanceOption = (
  access: AdminTokenOutput['credentials'] | ModeratorOutput['credentials'],
) => {
  const fullPermission = [
    'tools.ozone.team.defs#roleAdmin',
    'tools.ozone.team.defs#roleModerator',
    'tools.ozone.team.defs#roleTriage',
  ]
  if (access.type === 'admin_token') {
    return fullPermission
  }

  if (access.isAdmin) {
    return fullPermission
  }

  if (access.isModerator) {
    return [
      'tools.ozone.team.defs#roleModerator',
      'tools.ozone.team.defs#roleTriage',
    ]
  }

  return ['tools.ozone.team.defs#roleTriage']
}

const getManagerRole = (role: string) => {
  let managerRole: Member['role'] | null = null

  if (role === 'tools.ozone.team.defs#roleAdmin') {
    managerRole = 'tools.ozone.team.defs#roleAdmin'
  } else if (role === 'tools.ozone.team.defs#roleModerator') {
    managerRole = 'tools.ozone.team.defs#roleModerator'
  } else if (role === 'tools.ozone.team.defs#roleTriage') {
    managerRole = 'tools.ozone.team.defs#roleTriage'
  }

  return managerRole
}
