import { ModerationDecision } from '../decision'
import { ModerationSubjectFeedGenerator, ModerationOpts } from '../types'
import { decideAccount } from './account'
import { decideProfile } from './profile'

export function decideFeedGenerator(
  subject: ModerationSubjectFeedGenerator,
  opts: ModerationOpts,
): ModerationDecision {
  // TODO handle labels applied on the feed generator itself
  return ModerationDecision.merge(
    decideAccount(subject.creator, opts),
    decideProfile(subject.creator, opts),
  )
}
