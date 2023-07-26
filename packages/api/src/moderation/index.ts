import { AppBskyActorDefs } from '../client/index'
import {
  ModerationSubjectProfile,
  ModerationSubjectPost,
  ModerationSubjectFeedGenerator,
  ModerationSubjectUserList,
  ModerationOpts,
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
  isModerationDecisionNoop,
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
  opts: ModerationOpts,
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
  opts: ModerationOpts,
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

  // derive avatar blurring from account & profile, but override for mutes because that shouldnt blur
  let blurAvatar = false
  if ((account.blur || account.blurMedia) && account.cause?.type !== 'muted') {
    blurAvatar = true
  } else if (
    (profile.blur || profile.blurMedia) &&
    profile.cause?.type !== 'muted'
  ) {
    blurAvatar = true
  }

  return {
    decisions: { post, account, profile, quote, quotedAccount },

    // content behaviors are pulled from feed and view derivations above
    content: {
      cause: !isModerationDecisionNoop(mergedForView)
        ? mergedForView.cause
        : mergedForFeed.filter
        ? mergedForFeed.cause
        : undefined,
      filter: mergedForFeed.filter,
      blur: mergedForView.blur,
      alert: mergedForView.alert,
      noOverride: mergedForView.noOverride,
    },

    // blur or alert the avatar based on the account and profile decisions
    avatar: {
      blur: blurAvatar,
      alert: account.alert || profile.alert,
      noOverride: account.noOverride || profile.noOverride,
    },

    // blur the embed if the quoted post required it,
    // or else if the post decision was to blur media
    embed: !isModerationDecisionNoop(mergedQuote, { ignoreFilter: true })
      ? {
          cause: mergedQuote.cause,
          blur: mergedQuote.blur,
          alert: mergedQuote.alert,
          noOverride: mergedQuote.noOverride,
        }
      : post.blurMedia
      ? {
          cause: post.cause,
          blur: true,
          noOverride: post.noOverride,
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
  opts: ModerationOpts,
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
      cause: isModerationDecisionNoop(merged) ? undefined : merged.cause,
      filter: merged.filter,
      blur: merged.blur,
      alert: merged.alert,
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
  opts: ModerationOpts,
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
      cause: isModerationDecisionNoop(merged) ? undefined : merged.cause,
      filter: merged.filter,
      blur: merged.blur,
      alert: merged.alert,
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
