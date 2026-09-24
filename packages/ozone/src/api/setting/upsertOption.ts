import assert from 'node:assert'
import type { DidString } from '@atproto/lex'
import { AuthRequiredError, type Server } from '@atproto/xrpc-server'
import type { AdminTokenOutput, ModeratorOutput } from '../../auth-verifier.js'
import type { AppContext } from '../../context.js'
import type { Member } from '../../db/schema/member.js'
import { tools } from '../../lexicons/index.js'
import type { SettingService } from '../../setting/service.js'
import { settingValidators } from '../../setting/validators.js'

const ROLEADMIN = tools.ozone.team.defs.roleAdmin.value
const ROLEMODERATOR = tools.ozone.team.defs.roleModerator.value
const ROLETRIAGE = tools.ozone.team.defs.roleTriage.value
const ROLEVERIFIER = tools.ozone.team.defs.roleVerifier.value

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.setting.upsertOption, {
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
        const option = {
          ...baseOption,
          scope: 'instance' as const,
          managerRole: getManagerRole(managerRole),
        }

        if (settingValidators.has(key)) {
          await settingValidators.get(key)?.(option)
        }

        await settingService.upsert(option)
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
  did: DidString,
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
  const fullPermission = [ROLEADMIN, ROLEMODERATOR, ROLETRIAGE, ROLEVERIFIER]
  if (access.type === 'admin_token') {
    return fullPermission
  }

  if (access.isAdmin) {
    return fullPermission
  }

  if (access.isModerator) {
    return [ROLEMODERATOR, ROLETRIAGE]
  }

  if (access.isVerifier) {
    return [ROLEVERIFIER]
  }

  return [ROLETRIAGE]
}

const getManagerRole = (role?: string) => {
  let managerRole: Member['role'] | null = null

  if (role === ROLEADMIN) {
    managerRole = ROLEADMIN
  } else if (role === ROLEMODERATOR) {
    managerRole = ROLEMODERATOR
  } else if (role === ROLETRIAGE) {
    managerRole = ROLETRIAGE
  } else if (role === ROLEVERIFIER) {
    managerRole = ROLEVERIFIER
  }

  return managerRole
}
