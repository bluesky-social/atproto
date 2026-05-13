import { AtUri } from '@atproto/syntax'
import { AppBskyActorDefs } from '../../client/index.js'
import { ModerationDecision } from '../decision.js'
import { ModerationOpts, ModerationSubjectUserList } from '../types.js'
import { decideAccount } from './account.js'
import { decideProfile } from './profile.js'

export function decideUserList(
  subject: ModerationSubjectUserList,
  opts: ModerationOpts,
): ModerationDecision {
  const acc = new ModerationDecision()

  const creator =
    // Note: ListViewBasic should not contain a creator field, but let's support it anyway
    'creator' in subject && isProfile(subject.creator)
      ? subject.creator
      : undefined

  if (creator) {
    acc.setDid(creator.did)
    acc.setIsMe(creator.did === opts.userDid)
    if (subject.labels?.length) {
      for (const label of subject.labels) {
        acc.addLabel('content', label, opts)
      }
    }
    return ModerationDecision.merge(
      acc,
      decideAccount(creator, opts),
      decideProfile(creator, opts),
    )
  }

  const creatorDid = new AtUri(subject.uri).hostname
  acc.setDid(creatorDid)
  acc.setIsMe(creatorDid === opts.userDid)
  if (subject.labels?.length) {
    for (const label of subject.labels) {
      acc.addLabel('content', label, opts)
    }
  }
  return acc
}

function isProfile(v: any): v is AppBskyActorDefs.ProfileViewBasic {
  return v && typeof v === 'object' && 'did' in v
}
