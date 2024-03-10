import { AppBskyActorDefs } from '../../client/index'
import { ModerationDecision } from '../decision'
import { ModerationSubjectUserList, ModerationOpts } from '../types'
import { decideAccount } from './account'
import { decideProfile } from './profile'

export function decideUserList(
  subject: ModerationSubjectUserList,
  opts: ModerationOpts,
): ModerationDecision {
  // TODO handle labels applied on the list itself
  const account = AppBskyActorDefs.isProfileViewBasic(subject.creator)
    ? decideAccount(subject.creator, opts)
    : new ModerationDecision()
  const profile = AppBskyActorDefs.isProfileViewBasic(subject.creator)
    ? decideProfile(subject.creator, opts)
    : new ModerationDecision()
  return ModerationDecision.merge(account, profile)
}
