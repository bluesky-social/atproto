import { ModerationDecision } from '../decision.js'
import { Label, ModerationOpts, ModerationSubjectProfile } from '../types.js'

export function decideProfile(
  subject: ModerationSubjectProfile,
  opts: ModerationOpts,
): ModerationDecision {
  const acc = new ModerationDecision()

  acc.setDid(subject.did)
  acc.setIsMe(subject.did === opts.userDid)
  for (const label of filterProfileLabels(subject.labels)) {
    acc.addLabel('profile', label, opts)
  }

  return acc
}

export function filterProfileLabels(labels?: Label[]): Label[] {
  if (!labels) {
    return []
  }
  return labels.filter((label) =>
    label.uri.endsWith('/app.bsky.actor.profile/self'),
  )
}
