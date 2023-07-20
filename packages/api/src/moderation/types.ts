import {
  AppBskyActorDefs,
  AppBskyFeedDefs,
  AppBskyGraphDefs,
  ComAtprotoLabelDefs,
} from '../client/index'

// labels
// =

export type Label = ComAtprotoLabelDefs.Label

export type LabelDefinitionPreference = 'ignore' | 'warn' | 'hide'
export type LabelDefinitionFlag = 'no-override' | 'adult'
export type LabelDefinitionOnWarnBehavior =
  | 'blur'
  | 'blur-media'
  | 'notice'
  | null

export interface LabelDefinitionLocalizedStrings {
  name: string
  description: string
}

export type LabelDefinitionLocalizedStringsMap = Record<
  string,
  LabelDefinitionLocalizedStrings
>

export interface LabelDefinition {
  id: string
  groupId: string
  preferences: LabelDefinitionPreference[]
  flags: LabelDefinitionFlag[]
  onwarn: LabelDefinitionOnWarnBehavior
  strings: {
    settings: LabelDefinitionLocalizedStringsMap
    account: LabelDefinitionLocalizedStringsMap
    content: LabelDefinitionLocalizedStringsMap
  }
}

export interface LabelGroupDefinition {
  id: string
  configurable: boolean
  labels: LabelDefinition[]
  strings: {
    settings: LabelDefinitionLocalizedStringsMap
  }
}

export type LabelDefinitionMap = Record<string, LabelDefinition>
export type LabelGroupDefinitionMap = Record<string, LabelGroupDefinition>

// labelers
// =

interface Labeler {
  uri: string
  displayName: string
}

export interface LabelerSettings {
  labelerUri: string
  settings: Record<string, LabelDefinitionPreference>
}

// subjects
// =

export type ModerationSubject =
  | AppBskyActorDefs.ProfileViewBasic
  | AppBskyActorDefs.ProfileView
  | AppBskyActorDefs.ProfileViewDetailed
  | AppBskyFeedDefs.PostView
  | AppBskyFeedDefs.GeneratorView
  | AppBskyGraphDefs.ListViewBasic
  | AppBskyGraphDefs.ListView

// behaviors
// =

export type ModerationSource =
  | { type: 'user' }
  | { type: 'list'; uri: string; displayName: string }
  | ({ type: 'labeler' } & Labeler)
  | undefined

export type ModerationCause =
  | { id: 'blocked' }
  | { id: 'blocked-by' }
  | { id: 'mute' }
  | { id: 'label'; label: LabelDefinition; setting: LabelDefinitionPreference }
  | undefined

export type ModerationBehaviorId = 'list' | 'view'

export type ModerationBehavior =
  | 'hide'
  | 'blur'
  | 'blur-media'
  | 'notice'
  | 'show'

export type ModerationBehaviorUsecase =
  | ModerationBehaviorId
  | 'feed'
  | 'search'
  | 'discovery'
  | 'thread'

export interface ModerationContext {
  userDid: string
  labelerSettings: LabelerSettings[]
}
