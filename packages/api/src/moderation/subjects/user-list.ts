import { AtUri } from '@atproto/syntax'
import { AppBskyActorDefs } from '../../client/index'
import { ModerationDecision } from '../decision'
import { ModerationSubjectUserList, ModerationOpts } from '../types'
import { decideAccount } from './account'
import { decideProfile } from './profile'

export function decideUserList(
  subject: ModerationSubjectUserList,
  opts: ModerationOpts,
): ModerationDecision {
  const acc = new ModerationDecision()

  const creator = isProfile(subject.creator) ? subject.creator : undefined

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
