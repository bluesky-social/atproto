import { ModerationCauseAccumulator } from '../accumulator'
import {
  Label,
  ModerationSubjectProfile,
  ModerationApplyOpts,
  ModerationDecision,
} from '../types'

export function decideAccount(
  subject: ModerationSubjectProfile,
  opts: ModerationApplyOpts,
): ModerationDecision {
  const acc = new ModerationCauseAccumulator()

  acc.setIsMe(subject.did === opts.userDid)
  acc.addMuted(subject.viewer?.muted)
  acc.addMutedByList(subject.viewer?.mutedByList)
  acc.addBlocking(subject.viewer?.blocking)
  acc.addBlockedBy(subject.viewer?.blockedBy)

  for (const label of filterAccountLabels(subject.labels)) {
    acc.addLabel(label, opts)
  }

  return acc.finalizeDecision(opts)
}

export function filterAccountLabels(labels?: Label[]): Label[] {
  if (!labels) {
    return []
  }
  return labels.filter(
    (label) => !label.uri.endsWith('/app.bsky.actor.profile/self'),
  )
}
