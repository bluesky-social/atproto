import {
  AppBskyActorDefs,
  AppBskyFeedDefs,
  AppBskyNotificationListNotifications,
  AppBskyGraphDefs,
  ComAtprotoLabelDefs,
} from '../client/index'
import { KnownLabelValue } from './const/labels'

// syntax
// =

export const CUSTOM_LABEL_VALUE_RE = /^[a-z-]+$/

// behaviors
// =

export interface ModerationBehavior {
  profileList?: 'blur' | 'alert' | 'inform'
  profileView?: 'blur' | 'alert' | 'inform'
  avatar?: 'blur' | 'alert'
  banner?: 'blur'
  displayName?: 'blur'
  contentList?: 'blur' | 'alert' | 'inform'
  contentView?: 'blur' | 'alert' | 'inform'
  contentMedia?: 'blur'
}
export const BLOCK_BEHAVIOR: ModerationBehavior = {
  profileList: 'blur',
  profileView: 'alert',
  avatar: 'blur',
  banner: 'blur',
  contentList: 'blur',
  contentView: 'blur',
}
export const MUTE_BEHAVIOR: ModerationBehavior = {
  profileList: 'inform',
  profileView: 'alert',
  contentList: 'blur',
  contentView: 'inform',
}
export const HIDE_BEHAVIOR: ModerationBehavior = {
  contentList: 'blur',
  contentView: 'blur',
}
export const NOOP_BEHAVIOR: ModerationBehavior = {}

// labels
// =

export type Label = ComAtprotoLabelDefs.Label
export type LabelTarget = 'account' | 'profile' | 'content'
export type LabelPreference = 'ignore' | 'warn' | 'hide'

export type LabelValueDefinitionFlag =
  | 'no-override'
  | 'adult'
  | 'unauthed'
  | 'no-self'

export interface InterprettedLabelValueDefinition
  extends ComAtprotoLabelDefs.LabelValueDefinition {
  // identifier: string
  configurable: boolean
  defaultSetting: LabelPreference // type narrowing
  flags: LabelValueDefinitionFlag[]
  behaviors: {
    account?: ModerationBehavior
    profile?: ModerationBehavior
    content?: ModerationBehavior
  }
}

export type LabelDefinitionMap = Record<
  KnownLabelValue,
  InterprettedLabelValueDefinition
>

// subjects
// =

export type ModerationSubjectProfile =
  | AppBskyActorDefs.ProfileViewBasic
  | AppBskyActorDefs.ProfileView
  | AppBskyActorDefs.ProfileViewDetailed

export type ModerationSubjectPost = AppBskyFeedDefs.PostView

export type ModerationSubjectNotification =
  AppBskyNotificationListNotifications.Notification

export type ModerationSubjectFeedGenerator = AppBskyFeedDefs.GeneratorView

export type ModerationSubjectUserList =
  | AppBskyGraphDefs.ListViewBasic
  | AppBskyGraphDefs.ListView

export type ModerationSubject =
  | ModerationSubjectProfile
  | ModerationSubjectPost
  | ModerationSubjectNotification
  | ModerationSubjectFeedGenerator
  | ModerationSubjectUserList

// behaviors
// =

export type ModerationCauseSource =
  | { type: 'user' }
  | { type: 'list'; list: AppBskyGraphDefs.ListViewBasic }
  | { type: 'labeler'; did: string }

export type ModerationCause =
  | { type: 'blocking'; source: ModerationCauseSource; priority: 3 }
  | { type: 'blocked-by'; source: ModerationCauseSource; priority: 4 }
  | { type: 'block-other'; source: ModerationCauseSource; priority: 4 }
  | {
      type: 'label'
      source: ModerationCauseSource
      label: Label
      labelDef: InterprettedLabelValueDefinition
      setting: LabelPreference
      behavior: ModerationBehavior
      noOverride: boolean
      priority: 1 | 2 | 5 | 7 | 8
    }
  | { type: 'muted'; source: ModerationCauseSource; priority: 6 }
  | { type: 'hidden'; source: ModerationCauseSource; priority: 6 }

export interface ModerationPrefsModerator {
  did: string
  labels: Record<string, LabelPreference>
}

export interface ModerationPrefs {
  adultContentEnabled: boolean
  labels: Record<string, LabelPreference>
  mods: ModerationPrefsModerator[]
}

export interface ModerationOpts {
  userDid: string | undefined
  prefs: ModerationPrefs
  /**
   * Map of labeler did -> custom definitions
   */
  labelDefs?: Record<string, InterprettedLabelValueDefinition[]>
}
