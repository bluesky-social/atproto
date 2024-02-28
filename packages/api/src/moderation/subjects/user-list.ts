import { ModerationDecision } from '../decision'
import { ModerationSubjectUserList, ModerationOpts } from '../types'

export function decideUserList(
  _subject: ModerationSubjectUserList,
  _opts: ModerationOpts,
): ModerationDecision {
  // TODO handle labels applied on the list itself
  return new ModerationDecision()
}
