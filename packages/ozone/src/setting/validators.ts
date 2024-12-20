import { Selectable } from 'kysely'
import { Setting } from '../db/schema/setting'
import { PolicyListSettingKey, ProtectedTagSettingKey } from './constants'
import { InvalidRequestError } from '@atproto/xrpc-server'

export const settingValidators = new Map<
  string,
  (setting: Partial<Selectable<Setting>>) => Promise<void>
>([
  [
    ProtectedTagSettingKey,
    async (setting: Partial<Selectable<Setting>>) => {
      if (setting.managerRole !== 'tools.ozone.team.defs#roleAdmin') {
        throw new InvalidRequestError(
          'Only admins should be able to configure protected tags',
        )
      }

      if (typeof setting.value !== 'object') {
        throw new InvalidRequestError('Invalid value')
      }
      for (const [key, val] of Object.entries(setting.value)) {
        if (!val || typeof val !== 'object') {
          throw new InvalidRequestError(`Invalid configuration for tag ${key}`)
        }

        if (!val['roles'] && !val['moderators']) {
          throw new InvalidRequestError(
            `Must define who a list of moderators or a role who can action subjects with ${key} tag`,
          )
        }

        if (val['roles']) {
          if (!Array.isArray(val['roles'])) {
            throw new InvalidRequestError(
              `Roles must be an array of moderator roles for tag ${key}`,
            )
          }
          if (!val['roles']?.length) {
            throw new InvalidRequestError(
              `Must define at least one role for tag ${key}`,
            )
          }
        }

        if (val['moderators']) {
          if (!Array.isArray(val['moderators'])) {
            throw new InvalidRequestError(
              `Moderators must be an array of moderator DIDs for tag ${key}`,
            )
          }
          if (!val['moderators']?.length) {
            throw new InvalidRequestError(
              `Must define at least one moderator DID for tag ${key}`,
            )
          }
        }
      }
    },
  ],
  [
    PolicyListSettingKey,
    async (setting: Partial<Selectable<Setting>>) => {
      if (setting.managerRole !== 'tools.ozone.team.defs#roleAdmin') {
        throw new InvalidRequestError(
          'Only admins should be able to manage policy list',
        )
      }

      if (typeof setting.value !== 'object') {
        throw new InvalidRequestError('Invalid value')
      }
      for (const [key, val] of Object.entries(setting.value)) {
        if (!val || typeof val !== 'object') {
          throw new InvalidRequestError(
            `Invalid configuration for policy ${key}`,
          )
        }

        if (!val['name'] || !val['description']) {
          throw new InvalidRequestError(
            `Must define a name and description for policy ${key}`,
          )
        }
      }
    },
  ],
])
