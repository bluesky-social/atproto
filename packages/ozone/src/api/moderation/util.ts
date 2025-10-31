import { InvalidRequestError } from '@atproto/xrpc-server'
import { ProtectedTagSettingKey } from '../../setting/constants'
import { SettingService } from '../../setting/service'
import { ProtectedTagSetting } from '../../setting/types'

export const getProtectedTags = async (
  settingService: SettingService,
  serviceDid: string,
) => {
  const protectedTagSetting = await settingService.query({
    keys: [ProtectedTagSettingKey],
    scope: 'instance',
    did: serviceDid,
    limit: 1,
  })

  // if no protected tags are configured, then no need to do further check
  if (!protectedTagSetting.options.length) {
    return
  }

  return protectedTagSetting.options[0].value as ProtectedTagSetting
}

export const assertProtectedTagAction = ({
  protectedTags,
  subjectTags,
  actionAuthor,
  isModerator,
  isAdmin,
  isTriage,
}: {
  protectedTags: ProtectedTagSetting
  subjectTags: string[]
  actionAuthor: string
  isModerator: boolean
  isAdmin: boolean
  isTriage: boolean
}) => {
  subjectTags.forEach((tag) => {
    if (!Object.hasOwn(protectedTags, tag)) return
    if (
      protectedTags[tag]['moderators'] &&
      !protectedTags[tag]['moderators'].includes(actionAuthor)
    ) {
      throw new InvalidRequestError(
        `Not allowed to action on protected tag: ${tag}`,
      )
    }

    if (protectedTags[tag]['roles']) {
      if (isAdmin) {
        if (
          protectedTags[tag]['roles'].includes(
            'tools.ozone.team.defs#roleAdmin',
          )
        ) {
          return
        }
        throw new InvalidRequestError(
          `Not allowed to action on protected tag: ${tag}`,
        )
      }

      if (isModerator) {
        if (
          protectedTags[tag]['roles'].includes(
            'tools.ozone.team.defs#roleModerator',
          )
        ) {
          return
        }

        throw new InvalidRequestError(
          `Not allowed to action on protected tag: ${tag}`,
        )
      }

      if (isTriage) {
        if (
          protectedTags[tag]['roles'].includes(
            'tools.ozone.team.defs#roleTriage',
          )
        ) {
          return
        }

        throw new InvalidRequestError(
          `Not allowed to action on protected tag: ${tag}`,
        )
      }
    }
  })
}

export const ScheduledTakedownTag = 'scheduled-takedown'
