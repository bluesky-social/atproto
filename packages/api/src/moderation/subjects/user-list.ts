import {
  ModerationSubjectUserList,
  ModerationOpts,
  ModerationDecision,
} from '../types'

export function decideUserList(
  subject: ModerationSubjectUserList,
  opts: ModerationOpts,
): ModerationDecision {
  // TODO handle labels applied on the list itself
  return ModerationDecision.noop()
}
