import { Selectable } from 'kysely'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Setting } from '../db/schema/setting'
import {
  PolicyListSettingKey,
  ProtectedTagSettingKey,
  SeverityLevelSettingKey,
} from './constants'

export const settingValidators = new Map<
  string,
  (setting: Partial<Selectable<Setting>>) => Promise<void>
>([
  [
    ProtectedTagSettingKey,
    /*
     * Example configuration:
     * {
     *   "sensitive-tag": {
     *     "roles": ["tools.ozone.team.defs#roleAdmin", "tools.ozone.team.defs#roleModerator"],
     *     "moderators": ["did:plc:example1", "did:plc:example2"]
     *   },
     *   "high-risk-tag": {
     *     "roles": ["tools.ozone.team.defs#roleAdmin"]
     *   },
     *   "admin-only-tag": {
     *     "moderators": ["did:plc:admin1"]
     *   }
     * }
     */
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
    /*
     * Example configuration:
     * {
     *   "harassment": {
     *     "name": "Anti-Harassment",
     *     "description": "Content that harasses, intimidates, or bullies users",
     *     "severityLevels": {
     *       "sev-1": {
     *         "description": "Minor harassment",
     *         "isDefault": true
     *       },
     *       "sev-2": {
     *         "description": "Moderate harassment",
     *         "isDefault": false
     *       },
     *       "sev-4": {
     *         "description": "Severe harassment",
     *         "isDefault": false
     *       }
     *     }
     *   },
     *   "death-threats": {
     *     "name": "Death Threats",
     *     "description": "Threats of violence or death against individuals",
     *     "severityLevels": {
     *       "death-threat": {
     *         "description": "Death threat violation",
     *         "isDefault": true
     *       }
     *     }
     *   },
     *   "spam": {
     *     "name": "Spam",
     *     "description": "Unsolicited or repetitive content",
     *     "severityLevels": {
     *       "sev-0": {
     *         "description": "Minor spam",
     *         "isDefault": false
     *       },
     *       "sev-1": {
     *         "description": "Moderate spam",
     *         "isDefault": true
     *       },
     *       "sev-2": {
     *         "description": "Severe spam",
     *         "isDefault": false
     *       }
     *     }
     *   },
     *   "minimal-policy": {
     *     "name": "Basic Policy",
     *     "description": "Simple policy without severity levels"
     *   }
     * }
     */
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

        if (val['severityLevels'] !== undefined) {
          if (typeof val['severityLevels'] !== 'object') {
            throw new InvalidRequestError(
              `Severity levels must be an object for policy ${key}`,
            )
          }

          let hasDefault = false
          for (const [severityKey, severityVal] of Object.entries(
            val['severityLevels'],
          )) {
            if (!severityVal || typeof severityVal !== 'object') {
              throw new InvalidRequestError(
                `Invalid configuration for severity level ${severityKey} in policy ${key}`,
              )
            }

            if (
              severityVal['description'] !== undefined &&
              typeof severityVal['description'] !== 'string'
            ) {
              throw new InvalidRequestError(
                `Description must be a string for severity level ${severityKey} in policy ${key}`,
              )
            }

            if (severityVal['isDefault'] !== undefined) {
              if (typeof severityVal['isDefault'] !== 'boolean') {
                throw new InvalidRequestError(
                  `isDefault must be a boolean for severity level ${severityKey} in policy ${key}`,
                )
              }
              if (severityVal['isDefault']) {
                if (hasDefault) {
                  throw new InvalidRequestError(
                    `Only one severity level can be the default for policy ${key}`,
                  )
                }
                hasDefault = true
              }
            }

            if (severityVal['targetServices'] !== undefined) {
              if (!Array.isArray(severityVal['targetServices'])) {
                throw new InvalidRequestError(
                  `targetServices must be an array for severity level ${severityKey} in policy ${key}`,
                )
              }
              for (const service of severityVal['targetServices']) {
                if (typeof service !== 'string') {
                  throw new InvalidRequestError(
                    `Each target service must be a string for severity level ${severityKey} in policy ${key}`,
                  )
                }
              }
            }
          }
        }
      }
    },
  ],
  [
    SeverityLevelSettingKey,
    /*
     * Example configuration:
     * {
     *   "sev-0": {
     *     "strikeCount": 0
     *   },
     *   "sev-1": {
     *     "strikeCount": 1,
     *     "strikeOnOccurrence": 2
     *   },
     *   "sev-2": {
     *     "strikeCount": 2
     *   },
     *   "sev-4": {
     *     "strikeCount": 4,
     *     "expiresInDays": 365
     *   },
     *   "sev-5": {
     *     "needsTakedown": true
     *   },
     *   "death-threat": {
     *     "strikeCount": 4,
     *     "firstOccurrenceStrikeCount": 4,
     *   },
     *   "custom-severity": {
     *     "strikeCount": 3,
     *     "strikeOnOccurrence": 1,
     *   },
     *   "escalating-severity": {
     *     "firstOccurrenceStrikeCount": 2,
     *     "repeatOccurrenceStrikeCount": 5
     *   }
     * }
     */
    async (setting: Partial<Selectable<Setting>>) => {
      if (setting.managerRole !== 'tools.ozone.team.defs#roleAdmin') {
        throw new InvalidRequestError(
          'Only admins should be able to manage severity levels',
        )
      }

      if (typeof setting.value !== 'object') {
        throw new InvalidRequestError('Invalid value')
      }

      for (const [key, val] of Object.entries(setting.value)) {
        if (!val || typeof val !== 'object') {
          throw new InvalidRequestError(
            `Invalid configuration for severity level ${key}`,
          )
        }

        if (val['strikeCount'] !== undefined) {
          if (
            typeof val['strikeCount'] !== 'number' ||
            !Number.isInteger(val['strikeCount']) ||
            val['strikeCount'] < 0
          ) {
            throw new InvalidRequestError(
              `Strike count must be a non-negative integer for severity level ${key}`,
            )
          }
        }

        if (val['strikeOnOccurrence'] !== undefined) {
          if (
            typeof val['strikeOnOccurrence'] !== 'number' ||
            !Number.isInteger(val['strikeOnOccurrence']) ||
            val['strikeOnOccurrence'] < 1
          ) {
            throw new InvalidRequestError(
              `Strike on occurrence must be a positive integer for severity level ${key}`,
            )
          }
        }

        if (val['needsTakedown'] !== undefined) {
          if (typeof val['needsTakedown'] !== 'boolean') {
            throw new InvalidRequestError(
              `Needs takedown must be a boolean for severity level ${key}`,
            )
          }
        }

        if (val['expiresInDays'] !== undefined) {
          if (
            typeof val['expiresInDays'] !== 'number' ||
            !Number.isInteger(val['expiresInDays']) ||
            val['expiresInDays'] < 0
          ) {
            throw new InvalidRequestError(
              `Expires in days must be a non-negative integer for severity level ${key}`,
            )
          }
        }

        if (val['firstOccurrenceStrikeCount'] !== undefined) {
          if (
            typeof val['firstOccurrenceStrikeCount'] !== 'number' ||
            !Number.isInteger(val['firstOccurrenceStrikeCount']) ||
            val['firstOccurrenceStrikeCount'] < 0
          ) {
            throw new InvalidRequestError(
              `First occurrence strike count must be a non-negative integer for severity level ${key}`,
            )
          }
        }
      }
    },
  ],
])
