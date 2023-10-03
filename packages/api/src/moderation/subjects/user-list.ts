import {
  ModerationSubjectUserList,
  ModerationOpts,
  ModerationDecision,
} from '../types'

export function decideUserList(
  _subject: ModerationSubjectUserList,
  _opts: ModerationOpts,
): ModerationDecision {
  // TODO handle labels applied on the list itself
  return ModerationDecision.noop()
}
