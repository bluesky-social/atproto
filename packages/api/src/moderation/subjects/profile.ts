import { ModerationCauseAccumulator } from '../accumulator'
import {
  Label,
  ModerationSubjectProfile,
  ModerationOpts,
  ModerationDecision,
} from '../types'

export function decideProfile(
  subject: ModerationSubjectProfile,
  opts: ModerationOpts,
): ModerationDecision {
  const acc = new ModerationCauseAccumulator()

  acc.setDid(subject.did)

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
