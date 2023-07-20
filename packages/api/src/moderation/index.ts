import {
  AppBskyActorDefs,
  AppBskyFeedDefs,
  AppBskyGraphDefs,
} from '../client/index'
import {
  Label,
  ModerationCause,
  ModerationSource,
  ModerationBehaviorId,
  ModerationBehavior,
  ModerationBehaviorUsecase,
  ModerationSubject,
  ModerationContext,
} from './types'

export class Moderation {
  static apply = apply
  static merge = merge
  static noop() {
    return new Moderation(
      undefined,
      undefined,
      { list: 'show', view: 'show', author: 'show' },
      false,
    )
  }

  constructor(
    public cause: ModerationCause,
    public source: ModerationSource,
    public behaviors: Record<ModerationBehaviorId, ModerationBehavior>,
    public noOverride: boolean,
  ) {}

  behaviorIn(usecase: ModerationBehaviorUsecase) {
    switch (usecase) {
      case 'discovery':
      case 'search':
      case 'feed':
      case 'list':
        return this.behaviors.list
      case 'view':
      case 'thread':
        return this.behaviors.view
    }
  }

  merge(decisions: Moderation[]): Moderation {
    return Moderation.merge([this, ...decisions])
  }
}

function apply(subject: ModerationSubject, ctx: ModerationContext): Moderation {
  // profile
  if (
    AppBskyActorDefs.isProfileViewBasic(subject) ||
    AppBskyActorDefs.isProfileView(subject) ||
    AppBskyActorDefs.isProfileViewDetailed(subject)
  ) {
    return applyProfile(subject, ctx)
  }

  // post
  if (AppBskyFeedDefs.isPostView(subject)) {
    return applyPost(subject, ctx)
  }

  // feed generator
  if (AppBskyFeedDefs.isGeneratorView(subject)) {
    return applyFeedGenerator(subject, ctx)
  }

  // user list
  if (
    AppBskyGraphDefs.isListViewBasic(subject) ||
    AppBskyGraphDefs.isListView(subject)
  ) {
    return applyList(subject, ctx)
  }

  // none
  return Moderation.noop()
}

function applyProfile(
  subject:
    | AppBskyActorDefs.ProfileViewBasic
    | AppBskyActorDefs.ProfileView
    | AppBskyActorDefs.ProfileViewDetailed,
  ctx: ModerationContext,
): Moderation {
  const {
    isMe,
    accountLabels,
    profileLabels,
    isMuted,
    mutedByList,
    isBlocking,
    isBlockedBy,
  } = getUserModState(subject, ctx)

  // TODO run decision tree
}

function applyPost(
  subject: AppBskyFeedDefs.PostView,
  ctx: ModerationContext,
): Moderation {
  const postLabels = subject.labels || []
  const {
    isMe,
    accountLabels,
    profileLabels,
    isMuted,
    mutedByList,
    isBlocking,
    isBlockedBy,
  } = getUserModState(subject.author, ctx)

  if (subject.embed) {
    // TODO handle embedded posts
  }

  // TODO run decision tree
}

function applyFeedGenerator(
  subject: AppBskyFeedDefs.GeneratorView,
  ctx: ModerationContext,
): Moderation {
  const {
    isMe,
    accountLabels,
    profileLabels,
    isMuted,
    mutedByList,
    isBlocking,
    isBlockedBy,
  } = getUserModState(subject.creator, ctx)
  // TODO handle labels applied on the feed generator itself

  // TODO run decision tree
}

function applyList(
  subject: AppBskyGraphDefs.ListViewBasic | AppBskyGraphDefs.ListView,
  ctx: ModerationContext,
): Moderation {
  const {
    isMe,
    accountLabels,
    profileLabels,
    isMuted,
    mutedByList,
    isBlocking,
    isBlockedBy,
  } = getUserModState(
    AppBskyGraphDefs.isListView(subject) ? subject.creator : undefined,
    ctx,
  )
  // TODO handle labels applied on the feed generator itself

  // TODO run decision tree
}

function merge(decisions: Moderation[]): Moderation {
  // TODO
}

interface UserModState {
  isMe: boolean
  accountLabels: Label[]
  profileLabels: Label[]
  isMuted: boolean
  mutedByList?: AppBskyGraphDefs.ListViewBasic
  isBlocking: boolean
  isBlockedBy: boolean
}

function getUserModState(
  profile:
    | AppBskyActorDefs.ProfileViewBasic
    | AppBskyActorDefs.ProfileView
    | AppBskyActorDefs.ProfileViewDetailed
    | undefined,
  ctx: ModerationContext,
): UserModState {
  if (typeof profile === 'undefined') {
    return {
      isMe: false,
      accountLabels: [],
      profileLabels: [],
      isMuted: false,
      isBlocking: false,
      isBlockedBy: false,
    }
  }
  return {
    isMe: profile.did === ctx.userDid,
    accountLabels: filterAccountLabels(profile.labels),
    profileLabels: filterProfileLabels(profile.labels),
    isMuted: profile.viewer?.muted || false,
    mutedByList: profile.viewer?.mutedByList,
    isBlocking: !!profile.viewer?.blocking || false,
    isBlockedBy: !!profile.viewer?.blockedBy || false,
  }
}

export function filterAccountLabels(labels?: Label[]): Label[] {
  if (!labels) {
    return []
  }
  return labels.filter(
    (label) => !label.uri.endsWith('/app.bsky.actor.profile/self'),
  )
}

export function filterProfileLabels(labels?: Label[]): Label[] {
  if (!labels) {
    return []
  }
  return labels.filter((label) =>
    label.uri.endsWith('/app.bsky.actor.profile/self'),
  )
}
