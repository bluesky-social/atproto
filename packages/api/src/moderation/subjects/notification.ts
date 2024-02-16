import { ModerationDecision } from '../decision'
import { ModerationSubjectNotification, ModerationOpts } from '../types'

export function decideNotification(
  subject: ModerationSubjectNotification,
  opts: ModerationOpts,
): ModerationDecision {
  const acc = new ModerationDecision()

  acc.setDid(subject.author.did)
  acc.setIsMe(subject.author.did === opts.userDid)
  if (
    subject.type === 'reply' ||
    subject.type === 'quote' ||
    subject.type === 'mention'
  ) {
    if (subject.labels?.length) {
      for (const label of subject.labels) {
        acc.addLabel('content', label, opts)
      }
    }
  }

  return acc
}
