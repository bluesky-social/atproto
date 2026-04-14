import { ModerationDecision } from '../decision'
import { ModerationOpts, ModerationSubjectProfile } from '../types'
import { decideAccount } from './account'
import { decideProfile } from './profile'

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
