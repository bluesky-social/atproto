export type ProtectedTagSetting = {
  [key: string]: { roles?: string[]; moderators?: string[] }
}

export type PriorityLevelSetting = Record<
  string,
  {
    name: string
    targetResolutionMinutes: number
    score: number
  }
>

export type ReportReasonPrioritySetting = Record<string, string>

export type ResolvedReportPriority = {
  level: string
  score: number
  targetResolutionMinutes: number
}
