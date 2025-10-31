import { ModerationDecision } from './decision'
import { decideAccount } from './subjects/account'
import { decideFeedGenerator } from './subjects/feed-generator'
import { decideNotification } from './subjects/notification'
import { decidePost } from './subjects/post'
import { decideProfile } from './subjects/profile'
import { decideUserList } from './subjects/user-list'
import {
  ModerationOpts,
  ModerationSubjectFeedGenerator,
  ModerationSubjectNotification,
  ModerationSubjectPost,
  ModerationSubjectProfile,
  ModerationSubjectUserList,
} from './types'

export { ModerationUI } from './ui'
export { ModerationDecision } from './decision'
export { hasMutedWord, matchMuteWords } from './mutewords'
export {
  interpretLabelValueDefinition,
  interpretLabelValueDefinitions,
} from './util'

export function moderateProfile(
  subject: ModerationSubjectProfile,
  opts: ModerationOpts,
): ModerationDecision {
  return ModerationDecision.merge(
    decideAccount(subject, opts),
    decideProfile(subject, opts),
  )
}

export function moderatePost(
  subject: ModerationSubjectPost,
  opts: ModerationOpts,
): ModerationDecision {
  return decidePost(subject, opts)
}

export function moderateNotification(
  subject: ModerationSubjectNotification,
  opts: ModerationOpts,
): ModerationDecision {
  return decideNotification(subject, opts)
}

export function moderateFeedGenerator(
  subject: ModerationSubjectFeedGenerator,
  opts: ModerationOpts,
): ModerationDecision {
  return decideFeedGenerator(subject, opts)
}

export function moderateUserList(
  subject: ModerationSubjectUserList,
  opts: ModerationOpts,
): ModerationDecision {
  return decideUserList(subject, opts)
}
