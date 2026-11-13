import { ModerationDecision } from '../decision.js'
import type { ModerationOpts, ModerationSubjectProfile } from '../types.js'
import { decideAccount } from './account.js'
import { decideProfile } from './profile.js'

export function decideStatus(
  subject: ModerationSubjectProfile,
  opts: ModerationOpts,
): ModerationDecision {
  const acc = new ModerationDecision()

  acc.setDid(subject.did)
  acc.setIsMe(subject.did === opts.userDid)
  if ('status' in subject) {
    if (subject.status?.labels?.length) {
      for (const label of subject.status.labels) {
        acc.addLabel('content', label, opts)
      }
    }
  }

  return ModerationDecision.merge(
    acc,
    decideAccount(subject, opts),
    decideProfile(subject, opts),
  )
}
