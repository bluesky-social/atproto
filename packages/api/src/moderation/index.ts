import { AppBskyActorDefs } from '../client/index'
import {
  ModerationSubjectProfile,
  ModerationSubjectPost,
  ModerationSubjectNotification,
  ModerationSubjectFeedGenerator,
  ModerationSubjectUserList,
  ModerationOpts,
} from './types'
import { decideAccount } from './subjects/account'
import { decideProfile } from './subjects/profile'
import { decideNotification } from './subjects/notification'
import { decidePost } from './subjects/post'
import { decideFeedGenerator } from './subjects/feed-generator'
import { decideUserList } from './subjects/user-list'
import { ModerationDecision } from './decision'

export { ModerationUI } from './ui'
export { ModerationDecision } from './decision'
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
  return ModerationDecision.merge(
    decidePost(subject, opts),
    decideAccount(subject.author, opts),
    decideProfile(subject.author, opts),
  )
}

export function moderateNotification(
  subject: ModerationSubjectNotification,
  opts: ModerationOpts,
): ModerationDecision {
  return ModerationDecision.merge(
    decideNotification(subject, opts),
    decideAccount(subject.author, opts),
    decideProfile(subject.author, opts),
  )
}

export function moderateFeedGenerator(
  subject: ModerationSubjectFeedGenerator,
  opts: ModerationOpts,
): ModerationDecision {
  return ModerationDecision.merge(
    decideFeedGenerator(subject, opts),
    decideAccount(subject.creator, opts),
    decideProfile(subject.creator, opts),
  )
}

export function moderateUserList(
  subject: ModerationSubjectUserList,
  opts: ModerationOpts,
): ModerationDecision {
  const userList = decideUserList(subject, opts)
  const account = AppBskyActorDefs.isProfileViewBasic(subject.creator)
    ? decideAccount(subject.creator, opts)
    : new ModerationDecision()
  const profile = AppBskyActorDefs.isProfileViewBasic(subject.creator)
    ? decideProfile(subject.creator, opts)
    : new ModerationDecision()
  return ModerationDecision.merge(userList, account, profile)
}
