import { ComAtprotoLabelDefs } from '../client/index'

export type Label = ComAtprotoLabelDefs.Label

export type LabelPreference = 'ignore' | 'warn' | 'hide'
export type LabelFlag = 'no-override' | 'adult'
export type LabelOnWarnBehavior = 'blur' | 'blur-media' | 'notice' | null

export interface LocalizedStrings {
  name: string
  description: string
}

export type LocalizedStringsMap = Record<string, LocalizedStrings>

export interface LabelDefinition {
  id: string
  groupId: string
  preferences: LabelPreference[]
  flags: LabelFlag[]
  onwarn: LabelOnWarnBehavior
  strings: {
    settings: LocalizedStringsMap
    account: LocalizedStringsMap
    content: LocalizedStringsMap
  }
}

export interface LabelGroupDefinition {
  id: string
  configurable: boolean
  labels: LabelDefinition[]
  strings: {
    settings: LocalizedStringsMap
  }
}

export type LabelDefinitionMap = Record<string, LabelDefinition>
export type LabelGroupDefinitionMap = Record<string, LabelGroupDefinition>
