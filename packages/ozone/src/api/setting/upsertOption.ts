import { AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'
import { AdminTokenOutput, ModeratorOutput } from '../../auth-verifier'
import { SettingService } from '../../setting/service'
import { Member } from '../../db/schema/member'
import { ToolsOzoneTeamDefs } from '@atproto/api'
import assert from 'node:assert'

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
        const existingSetting = await getExistingSetting(
          settingService,
          ownerDid,
          key,
          'instance',
        )

        if (
          existingSetting?.managerRole &&
          !manageableRoles.includes(existingSetting.managerRole)
        ) {
          throw new AuthRequiredError(`Not permitted to update setting ${key}`)
        }
        await settingService.upsert({
          ...baseOption,
          scope: 'instance',
          managerRole: getManagerRole(managerRole),
        })
      }

      const newOption = await getExistingSetting(
        settingService,
        ownerDid,
        key,
        scope,
      )
      assert(newOption, 'Failed to get the updated setting')

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
  did: string,
  key: string,
  scope: string,
) => {
  const result = await settingService.query({
    scope: scope === 'personal' ? 'personal' : 'instance',
    keys: [key],
    limit: 1,
    did,
  })

  return result.options[0]
}

const getRolesForInstanceOption = (
  access: AdminTokenOutput['credentials'] | ModeratorOutput['credentials'],
) => {
  const fullPermission = [
    ToolsOzoneTeamDefs.ROLEADMIN,
    ToolsOzoneTeamDefs.ROLEMODERATOR,
    ToolsOzoneTeamDefs.ROLETRIAGE,
  ]
  if (access.type === 'admin_token') {
    return fullPermission
  }

  if (access.isAdmin) {
    return fullPermission
  }

  if (access.isModerator) {
    return [ToolsOzoneTeamDefs.ROLEMODERATOR, ToolsOzoneTeamDefs.ROLETRIAGE]
  }

  return [ToolsOzoneTeamDefs.ROLETRIAGE]
}

const getManagerRole = (role?: string) => {
  let managerRole: Member['role'] | null = null

  if (role === ToolsOzoneTeamDefs.ROLEADMIN) {
    managerRole = ToolsOzoneTeamDefs.ROLEADMIN
  } else if (role === ToolsOzoneTeamDefs.ROLEMODERATOR) {
    managerRole = ToolsOzoneTeamDefs.ROLEMODERATOR
  } else if (role === ToolsOzoneTeamDefs.ROLETRIAGE) {
    managerRole = ToolsOzoneTeamDefs.ROLETRIAGE
  }

  return managerRole
}
