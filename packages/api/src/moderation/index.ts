import { AppBskyActorDefs } from '../client/index'
import {
  ModerationSubjectProfile,
  ModerationSubjectPost,
  ModerationSubjectFeedGenerator,
  ModerationSubjectUserList,
  ModerationApplyOpts,
  ModerationDecision,
  ModerationUI,
} from './types'
import { decideAccount } from './subjects/account'
import { decideProfile } from './subjects/profile'
import { decidePost } from './subjects/post'
import {
  decideQuotedPost,
  decideQuotedPostAccount,
  decideQuotedPostWithMedia,
  decideQuotedPostWithMediaAccount,
} from './subjects/quoted-post'
import { decideFeedGenerator } from './subjects/feed-generator'
import { decideUserList } from './subjects/user-list'
import {
  mergeModerationDecisions,
  isQuotedPost,
  isQuotedPostWithMedia,
} from './util'

// profiles
// =

export interface ProfileModeration {
  decisions: {
    account: ModerationDecision
    profile: ModerationDecision
  }
  content: ModerationUI
  avatar: ModerationUI
}

export function moderateProfile(
  subject: ModerationSubjectProfile,
  opts: ModerationApplyOpts,
): ProfileModeration {
  // decide the moderation the account and the profile
  const account = decideAccount(subject, opts)
  const profile = decideProfile(subject, opts)

  // derive behaviors from both
  const merged = mergeModerationDecisions(profile, account)

  return {
    decisions: { account, profile },

    // content behaviors are pulled from merged decisions
    content: {
      filter: merged.filter,
      blur: merged.blur,
      alert: merged.alert,
      cause: merged.cause,
      noOverride: merged.noOverride,
    },

    // blur or alert the avatar based on the account and profile decisions
    avatar: {
      blur: account.blurMedia || profile.blurMedia,
      alert: account.alert,
      noOverride: account.noOverride || profile.noOverride,
    },
  }
}

// posts
// =

export interface PostModeration {
  decisions: {
    post: ModerationDecision
    account: ModerationDecision
    profile: ModerationDecision
    quote?: ModerationDecision
    quotedAccount?: ModerationDecision
  }
  content: ModerationUI
  avatar: ModerationUI
  embed: ModerationUI
}

export function moderatePost(
  subject: ModerationSubjectPost,
  opts: ModerationApplyOpts,
): PostModeration {
  // decide the moderation for the post, the post author's account,
  // and the post author's profile
  const post = decidePost(subject, opts)
  const account = decideAccount(subject.author, opts)
  const profile = decideProfile(subject.author, opts)

  // decide the moderation for any quoted posts
  let quote: ModerationDecision | undefined
  let quotedAccount: ModerationDecision | undefined
  if (isQuotedPost(subject.embed)) {
    quote = decideQuotedPost(subject.embed, opts)
    quotedAccount = decideQuotedPostAccount(subject.embed, opts)
  } else if (isQuotedPostWithMedia(subject.embed)) {
    quote = decideQuotedPostWithMedia(subject.embed, opts)
    quotedAccount = decideQuotedPostWithMediaAccount(subject.embed, opts)
  }

  // derive filtering from feeds from the post, post author's account,
  // quoted post, and quoted post author's account
  const mergedForFeed = mergeModerationDecisions(
    post,
    account,
    quote,
    quotedAccount,
  )

  // derive view blurring from the post and the post author's account
  const mergedForView = mergeModerationDecisions(post, account)

  // derive embed blurring from the quoted post and the quoted post author's account
  const mergedQuote = mergeModerationDecisions(quote, quotedAccount)

  return {
    decisions: { post, account, profile, quote, quotedAccount },

    // content behaviors are pulled from feed and view derivations above
    content: {
      filter: mergedForFeed.filter,
      blur: mergedForView.blur,
      alert: mergedForView.alert,
      cause: mergedForView.cause,
      noOverride: mergedForView.noOverride,
    },

    // blur or alert the avatar based on the account and profile decisions
    avatar: {
      blur: account.blurMedia || profile.blurMedia,
      alert: account.alert,
      noOverride: account.noOverride || profile.noOverride,
    },

    // blur the embed if the quoted post required it,
    // or else if the post decision was to blur media
    embed:
      quote || quotedAccount
        ? {
            blur: mergedQuote.blur,
            alert: mergedQuote.alert,
            cause: mergedQuote.cause,
            noOverride: mergedQuote.noOverride,
          }
        : mergedForView.blurMedia
        ? {
            blur: true,
            cause: mergedForView.cause,
            noOverride: mergedForView.noOverride,
          }
        : {},
  }
}

// feed generators
// =

export interface FeedGeneratorModeration {
  decisions: {
    feedGenerator: ModerationDecision
    account: ModerationDecision
    profile: ModerationDecision
  }
  content: ModerationUI
  avatar: ModerationUI
}

export function moderateFeedGenerator(
  subject: ModerationSubjectFeedGenerator,
  opts: ModerationApplyOpts,
): FeedGeneratorModeration {
  // decide the moderation for the generator, the generator creator's account,
  // and the generator creator's profile
  const feedGenerator = decideFeedGenerator(subject, opts)
  const account = decideAccount(subject.creator, opts)
  const profile = decideProfile(subject.creator, opts)

  // derive behaviors from feeds from the generator and the generator's account
  const merged = mergeModerationDecisions(feedGenerator, account)

  return {
    decisions: { feedGenerator, account, profile },

    // content behaviors are pulled from merged decisions
    content: {
      filter: merged.filter,
      blur: merged.blur,
      alert: merged.alert,
      cause: merged.cause,
      noOverride: merged.noOverride,
    },

    // blur or alert the avatar based on the account and profile decisions
    avatar: {
      blur: account.blurMedia || profile.blurMedia,
      alert: account.alert,
      noOverride: account.noOverride || profile.noOverride,
    },
  }
}

// user lists
// =

export interface UserListModeration {
  decisions: {
    userList: ModerationDecision
    account: ModerationDecision
    profile: ModerationDecision
  }
  content: ModerationUI
  avatar: ModerationUI
}

export function moderateUserList(
  subject: ModerationSubjectUserList,
  opts: ModerationApplyOpts,
): UserListModeration {
  // decide the moderation for the list, the list creator's account,
  // and the list creator's profile
  const userList = decideUserList(subject, opts)
  const account = AppBskyActorDefs.isProfileViewBasic(subject.creator)
    ? decideAccount(subject.creator, opts)
    : ModerationDecision.noop()
  const profile = AppBskyActorDefs.isProfileViewBasic(subject.creator)
    ? decideProfile(subject.creator, opts)
    : ModerationDecision.noop()

  // derive behaviors from feeds from the list and the list's account
  const merged = mergeModerationDecisions(userList, account)

  return {
    decisions: { userList, account, profile },

    // content behaviors are pulled from merged decisions
    content: {
      filter: merged.filter,
      blur: merged.blur,
      alert: merged.alert,
      cause: merged.cause,
      noOverride: merged.noOverride,
    },

    // blur or alert the avatar based on the account and profile decisions
    avatar: {
      blur: account.blurMedia || profile.blurMedia,
      alert: account.alert,
      noOverride: account.noOverride || profile.noOverride,
    },
  }
}
