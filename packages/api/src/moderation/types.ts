import {
  AppBskyActorDefs,
  AppBskyFeedDefs,
  AppBskyGraphDefs,
  ComAtprotoLabelDefs,
} from '../client/index'
import { LabelGroupId } from './const/label-groups'
import { KnownLabelValue } from './const/labels'

// labels
// =

export type Label = ComAtprotoLabelDefs.Label

export type LabelPreference = 'ignore' | 'warn' | 'hide'
export type LabelDefinitionFlag = 'no-override' | 'adult' | 'unauthed'
export type LabelDefinitionOnWarnBehavior =
  | 'blur'
  | 'blur-media'
  | 'alert'
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
  id: KnownLabelValue
  groupId: string
  configurable: boolean
  fixedPreference?: LabelPreference
  flags: LabelDefinitionFlag[]
  onwarn: LabelDefinitionOnWarnBehavior
}

export interface LabelGroupDefinition {
  id: LabelGroupId
  configurable: boolean
  labels: LabelDefinition[]
}

export type LabelDefinitionMap = Record<KnownLabelValue, LabelDefinition>
export type LabelGroupDefinitionMap = Record<LabelGroupId, LabelGroupDefinition>

// subjects
// =

export type ModerationSubjectProfile =
  | AppBskyActorDefs.ProfileViewBasic
  | AppBskyActorDefs.ProfileView
  | AppBskyActorDefs.ProfileViewDetailed

export type ModerationSubjectPost = AppBskyFeedDefs.PostView

export type ModerationSubjectFeedGenerator = AppBskyFeedDefs.GeneratorView

export type ModerationSubjectUserList =
  | AppBskyGraphDefs.ListViewBasic
  | AppBskyGraphDefs.ListView

export type ModerationSubject =
  | ModerationSubjectProfile
  | ModerationSubjectPost
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
      labelDef: LabelDefinition
      setting: LabelPreference
      priority: 1 | 2 | 5 | 7 | 8
    }
  | { type: 'muted'; source: ModerationCauseSource; priority: 6 }

export interface ModerationOpts {
  userDid: string
  adultContentEnabled: boolean
  labelGroups: Record<string, LabelPreference>
  mods: AppBskyActorDefs.ModsPref['mods']
}

export class ModerationDecision {
  static noop() {
    return new ModerationDecision()
  }

  constructor(
    public cause: ModerationCause | undefined = undefined,
    public alert: boolean = false,
    public blur: boolean = false,
    public blurMedia: boolean = false,
    public filter: boolean = false,
    public noOverride: boolean = false,
    public additionalCauses: ModerationCause[] = [],
    public did: string = '',
  ) {}
}

export interface ModerationUI {
  filter?: boolean
  blur?: boolean
  alert?: boolean
  cause?: ModerationCause
  noOverride?: boolean
}
