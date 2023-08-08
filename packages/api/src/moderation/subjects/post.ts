import { ModerationCauseAccumulator } from '../accumulator'
import {
  ModerationSubjectPost,
  ModerationOpts,
  ModerationDecision,
} from '../types'

export function decidePost(
  subject: ModerationSubjectPost,
  opts: ModerationOpts,
): ModerationDecision {
  const acc = new ModerationCauseAccumulator()

  acc.setDid(subject.author.did)

  if (subject.labels?.length) {
    for (const label of subject.labels) {
      acc.addLabel(label, opts)
    }
  }

  return acc.finalizeDecision(opts)
}
