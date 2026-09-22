import { AuthRequiredError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import type { Member } from '../../db/schema/member.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.setting.removeOptions, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { keys, scope } = input.body
      let did = ctx.cfg.service.did
      let managerRole: Member['role'][] = []

      if (scope === 'personal') {
        if (access.type !== 'moderator') {
          throw new AuthRequiredError(
            'Must use moderator auth to delete personal setting',
          )
        }

        did = access.iss
      }

      // When attempting to delete an instance setting using admin_token will allow removing any setting
      // otherwise, admins can remove settings that are manageable by all roles
      // moderators can remove settings that are manageable by moderator and triage roles
      // triage can remove settings that are manageable by triage role
      if (scope === 'instance') {
        managerRole = [
          tools.ozone.team.defs.RoleModerator,
          tools.ozone.team.defs.RoleTriage,
          tools.ozone.team.defs.RoleAdmin,
          tools.ozone.team.defs.RoleVerifier,
        ]

        if (access.type !== 'admin_token' && !access.isAdmin) {
          if (access.isModerator) {
            managerRole = [
              tools.ozone.team.defs.RoleModerator,
              tools.ozone.team.defs.RoleTriage,
            ]
          } else if (access.isTriage) {
            managerRole = [tools.ozone.team.defs.RoleTriage]
          }
        }
      }

      const settingService = ctx.settingService(db)

      await settingService.removeOptions(keys, {
        scope: scope === 'personal' ? 'personal' : 'instance',
        managerRole,
        did,
      })

      return {
        encoding: 'application/json',
        body: {},
      }
    },
  })
}
