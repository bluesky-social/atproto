import { ModerationDecision } from '../decision'
import { ModerationSubjectFeedGenerator, ModerationOpts } from '../types'

export function decideFeedGenerator(
  _subject: ModerationSubjectFeedGenerator,
  _opts: ModerationOpts,
): ModerationDecision {
  // TODO handle labels applied on the feed generator itself
  return new ModerationDecision()
}
