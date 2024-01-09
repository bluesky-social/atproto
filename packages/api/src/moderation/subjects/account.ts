import { ModerationCauseAccumulator } from '../accumulator'
import {
  Label,
  ModerationSubjectProfile,
  ModerationOpts,
  ModerationDecision,
} from '../types'

export function decideAccount(
  subject: ModerationSubjectProfile,
  opts: ModerationOpts,
): ModerationDecision {
  const acc = new ModerationCauseAccumulator()

  acc.setDid(subject.did)
  if (subject.viewer?.muted) {
    if (subject.viewer?.mutedByList) {
      acc.addMutedByList(subject.viewer?.mutedByList)
    } else {
      acc.addMuted(subject.viewer?.muted)
    }
  }
  if (subject.viewer?.blocking) {
    if (subject.viewer?.blockingByList) {
      acc.addBlockingByList(subject.viewer?.blockingByList)
    } else {
      acc.addBlocking(subject.viewer?.blocking)
    }
  }
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
    (label) =>
      !label.uri.endsWith('/app.bsky.actor.profile/self') ||
      label.val === '!no-unauthenticated',
  )
}
