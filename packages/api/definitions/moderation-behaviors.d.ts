import type { LabelPreference } from '../src'

export type ModerationTestSuiteResultFlag =
  | 'filter'
  | 'blur'
  | 'alert'
  | 'inform'
  | 'noOverride'

export interface ModerationTestSuiteScenario {
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
    profileList?: ModerationTestSuiteResultFlag[]
    profileView?: ModerationTestSuiteResultFlag[]
    avatar?: ModerationTestSuiteResultFlag[]
    banner?: ModerationTestSuiteResultFlag[]
    displayName?: ModerationTestSuiteResultFlag[]
    contentList?: ModerationTestSuiteResultFlag[]
    contentView?: ModerationTestSuiteResultFlag[]
    contentMedia?: ModerationTestSuiteResultFlag[]
  }
}

export interface ModerationTestSuite {
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
  scenarios: Record<string, ModerationTestSuiteScenario>
}
