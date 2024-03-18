import { ModerationDecision } from '../decision'
import { ModerationSubjectFeedGenerator, ModerationOpts } from '../types'
import { decideAccount } from './account'
import { decideProfile } from './profile'

export function decideFeedGenerator(
  subject: ModerationSubjectFeedGenerator,
  opts: ModerationOpts,
): ModerationDecision {
  const acc = new ModerationDecision()

  acc.setDid(subject.creator.did)
  acc.setIsMe(subject.creator.did === opts.userDid)
  if (subject.labels?.length) {
    for (const label of subject.labels) {
      acc.addLabel('content', label, opts)
    }
  }
  return ModerationDecision.merge(
    acc,
    decideAccount(subject.creator, opts),
    decideProfile(subject.creator, opts),
  )
}
