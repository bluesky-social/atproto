import { AppBskyActorDefs } from '../client/index'
import {
  ModerationSubjectProfile,
  ModerationSubjectPost,
  ModerationSubjectFeedGenerator,
  ModerationSubjectUserList,
  ModerationOpts,
} from './types'
import { decideAccount } from './subjects/account'
import { decideProfile } from './subjects/profile'
import { decidePost } from './subjects/post'
// import {
//   decideQuotedPost,
//   decideQuotedPostAccount,
//   decideQuotedPostWithMedia,
//   decideQuotedPostWithMediaAccount,
// } from './subjects/quoted-post'
import { decideFeedGenerator } from './subjects/feed-generator'
import { decideUserList } from './subjects/user-list'
// import { isQuotedPost, isQuotedPostWithMedia } from './util'
import { ModerationDecision } from './decision'

export { ModerationDecision } from './decision'

// profiles
// =

export function moderateProfile(
  subject: ModerationSubjectProfile,
  opts: ModerationOpts,
): ModerationDecision {
  return ModerationDecision.merge(
    decideAccount(subject, opts),
    decideProfile(subject, opts),
  )
}

// posts
// =

export function moderatePost(
  subject: ModerationSubjectPost,
  opts: ModerationOpts,
): ModerationDecision {
  // TODO should this be done elsewhere?
  // decide the moderation for any quoted posts
  // let quote: ModerationDecision | undefined
  // if (isQuotedPost(subject.embed)) {
  //   quote = ModerationDecision.merge(
  //     decideQuotedPost(subject.embed, opts),
  //     decideQuotedPostAccount(subject.embed, subject.author.did, opts),
  //   )
  // } else if (isQuotedPostWithMedia(subject.embed)) {
  //   quote = ModerationDecision.merge(
  //     decideQuotedPostWithMedia(subject.embed, opts),
  //     decideQuotedPostWithMediaAccount(subject.embed, subject.author.did, opts),
  //   )
  // }

  return ModerationDecision.merge(
    decidePost(subject, opts),
    decideAccount(subject.author, opts),
    decideProfile(subject.author, opts),
  )
}

// feed generators
// =

export function moderateFeedGenerator(
  subject: ModerationSubjectFeedGenerator,
  opts: ModerationOpts,
): ModerationDecision {
  return ModerationDecision.merge(
    decideFeedGenerator(subject, opts),
    decideAccount(subject.creator, opts),
    decideProfile(subject.creator, opts),
  )
}

// user lists
// =

export function moderateUserList(
  subject: ModerationSubjectUserList,
  opts: ModerationOpts,
): ModerationDecision {
  const userList = decideUserList(subject, opts)
  const account = AppBskyActorDefs.isProfileViewBasic(subject.creator)
    ? decideAccount(subject.creator, opts)
    : new ModerationDecision()
  const profile = AppBskyActorDefs.isProfileViewBasic(subject.creator)
    ? decideProfile(subject.creator, opts)
    : new ModerationDecision()
  return ModerationDecision.merge(userList, account, profile)
}
