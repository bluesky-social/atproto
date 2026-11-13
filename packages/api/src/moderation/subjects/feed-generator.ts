import { ModerationDecision } from '../decision.js'
import type {
  ModerationOpts,
  ModerationSubjectFeedGenerator,
} from '../types.js'
import { decideAccount } from './account.js'
import { decideProfile } from './profile.js'

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
