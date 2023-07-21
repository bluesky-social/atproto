import { ModerationCauseAccumulator } from '../accumulator'
import {
  ModerationSubjectPost,
  ModerationApplyOpts,
  ModerationDecision,
} from '../types'

export function decidePost(
  subject: ModerationSubjectPost,
  opts: ModerationApplyOpts,
): ModerationDecision {
  const acc = new ModerationCauseAccumulator()

  acc.setIsMe(subject.author.did === opts.userDid)

  if (subject.labels?.length) {
    for (const label of subject.labels) {
      acc.addLabel(label, opts)
    }
  }

  return acc.finalizeDecision(opts)
}
