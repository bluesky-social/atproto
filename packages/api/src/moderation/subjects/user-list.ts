import {
  ModerationSubjectUserList,
  ModerationApplyOpts,
  ModerationDecision,
} from '../types'

export function decideUserList(
  subject: ModerationSubjectUserList,
  opts: ModerationApplyOpts,
): ModerationDecision {
  // TODO handle labels applied on the list itself
  return ModerationDecision.noop()
}
