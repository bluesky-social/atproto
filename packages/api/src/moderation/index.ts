import { ModerationDecision } from './decision.js'
import { decideAccount } from './subjects/account.js'
import { decideFeedGenerator } from './subjects/feed-generator.js'
import { decideNotification } from './subjects/notification.js'
import { decidePost } from './subjects/post.js'
import { decideProfile } from './subjects/profile.js'
import { decideStatus } from './subjects/status.js'
import { decideUserList } from './subjects/user-list.js'
import {
  ModerationOpts,
  ModerationSubjectFeedGenerator,
  ModerationSubjectNotification,
  ModerationSubjectPost,
  ModerationSubjectProfile,
  ModerationSubjectUserList,
} from './types.js'

export { ModerationUI } from './ui.js'
export { ModerationDecision } from './decision.js'
export { hasMutedWord, matchMuteWords } from './mutewords.js'
export {
  interpretLabelValueDefinition,
  interpretLabelValueDefinitions,
} from './util.js'

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

export function moderateStatus(
  subject: ModerationSubjectProfile,
  opts: ModerationOpts,
): ModerationDecision {
  return decideStatus(subject, opts)
}
