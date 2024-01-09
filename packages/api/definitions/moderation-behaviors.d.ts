import type { LabelPreference } from '../src'

export interface ModerationBehaviorResult {
  cause?: string
  filter?: boolean
  blur?: boolean
  alert?: boolean
  noOverride?: boolean
}

export interface ModerationBehaviorScenario {
  cfg: string
  subject: 'post' | 'profile' | 'userlist' | 'feedgen'
  author: string
  quoteAuthor?: string
  labels: {
    post?: string[]
    profile?: string[]
    account?: string[]
    quotedPost?: string[]
    quotedAccount?: string[]
  }
  behaviors: {
    content?: ModerationBehaviorResult
    avatar?: ModerationBehaviorResult
    embed?: ModerationBehaviorResult
  }
}

export interface ModerationBehaviors {
  users: Record<
    string,
    {
      blocking: boolean
      blockingByList: boolean
      blockedBy: boolean
      muted: boolean
      mutedByList: boolean
    }
  >
  configurations: Record<
    string,
    {
      authed?: boolean
      adultContentEnabled: boolean
      settings: Record<string, LabelPreference>
    }
  >
  scenarios: Record<string, ModerationBehaviorScenario>
}
