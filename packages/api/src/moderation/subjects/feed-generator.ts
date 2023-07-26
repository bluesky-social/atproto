import {
  ModerationSubjectFeedGenerator,
  ModerationDecision,
  ModerationOpts,
} from '../types'

export function decideFeedGenerator(
  subject: ModerationSubjectFeedGenerator,
  opts: ModerationOpts,
): ModerationDecision {
  // TODO handle labels applied on the feed generator itself
  return ModerationDecision.noop()
}
