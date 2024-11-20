import { Selectable } from 'kysely'
import { Setting } from '../db/schema/setting'

export const settingValidators: Record<
  string,
  (setting: Partial<Selectable<Setting>>) => Promise<void>
> = {
  'tools.ozone.setting.protectedTags': async (
    setting: Partial<Selectable<Setting>>,
  ) => {
    if (setting.managerRole !== 'tools.ozone.team.defs#roleAdmin') {
      throw new Error('Only admins should be able to configure protected tags')
    }

    if (typeof setting.value !== 'object') {
      throw new Error('Invalid value')
    }
    for (const [key, val] of Object.entries(setting.value)) {
      if (typeof key !== 'string') {
        throw new Error('Invalid tag')
      }

      if (!val || typeof val !== 'object') {
        throw new Error(`Invalid configuration for tag ${key}`)
      }

      if (!val['roles'] && !val['moderators']) {
        throw new Error(
          `Must define who a list of moderators or a role who can action subjects with ${key} tag`,
        )
      }

      if (val['roles'] && !Array.isArray(val['roles'])) {
        throw new Error(
          `Roles must be an array of moderator roles for tag ${key}`,
        )
      }

      if (val['moderators'] && !Array.isArray(val['moderators'])) {
        throw new Error(
          `Moderators must be an array of moderator DIDs for tag ${key}`,
        )
      }
    }
  },
}
