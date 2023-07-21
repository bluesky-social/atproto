import { ModerationCauseAccumulator } from '../accumulator'
import {
  Label,
  ModerationSubjectProfile,
  ModerationApplyOpts,
  ModerationDecision,
} from '../types'

export function decideProfile(
  subject: ModerationSubjectProfile,
  opts: ModerationApplyOpts,
): ModerationDecision {
  const acc = new ModerationCauseAccumulator()

  acc.setIsMe(subject.did === opts.userDid)

  for (const label of filterProfileLabels(subject.labels)) {
    acc.addLabel(label, opts)
  }

  return acc.finalizeDecision(opts)
}

export function filterProfileLabels(labels?: Label[]): Label[] {
  if (!labels) {
    return []
  }
  return labels.filter((label) =>
    label.uri.endsWith('/app.bsky.actor.profile/self'),
  )
}
