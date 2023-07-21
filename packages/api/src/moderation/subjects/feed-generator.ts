import {
  ModerationSubjectFeedGenerator,
  ModerationDecision,
  ModerationApplyOpts,
} from '../types'

export function decideFeedGenerator(
  subject: ModerationSubjectFeedGenerator,
  opts: ModerationApplyOpts,
): ModerationDecision {
  // TODO handle labels applied on the feed generator itself
  return ModerationDecision.noop()
}
