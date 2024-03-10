import { ModerationDecision } from '../decision'
import { ModerationSubjectNotification, ModerationOpts } from '../types'
import { decideAccount } from './account'
import { decideProfile } from './profile'

export function decideNotification(
  subject: ModerationSubjectNotification,
  opts: ModerationOpts,
): ModerationDecision {
  const acc = new ModerationDecision()

  acc.setDid(subject.author.did)
  acc.setIsMe(subject.author.did === opts.userDid)
  if (subject.labels?.length) {
    for (const label of subject.labels) {
      acc.addLabel('content', label, opts)
    }
  }

  return ModerationDecision.merge(
    acc,
    decideAccount(subject.author, opts),
    decideProfile(subject.author, opts),
  )
}
