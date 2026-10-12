import type { Database } from '../db/index.js'
import {
  PriorityLevelSettingKey,
  ReportPriorityLevelSettingKey,
} from './constants.js'
import { SettingService } from './service.js'
import type {
  PriorityLevelSetting,
  ReportReasonPrioritySetting,
  ResolvedReportPriority,
} from './types.js'

/**
 * Resolve the priority settings for the given report types.
 */
export async function resolveReportPriorities(
  db: Database,
  reportTypes: string[],
): Promise<Map<string, ResolvedReportPriority>> {
  const { options } = await new SettingService(db).query({
    limit: 2,
    scope: 'instance',
    keys: [PriorityLevelSettingKey, ReportPriorityLevelSettingKey],
  })
  const levels = options.find(
    (option) => option.key === PriorityLevelSettingKey,
  )?.value as PriorityLevelSetting | undefined
  const mappings = options.find(
    (option) => option.key === ReportPriorityLevelSettingKey,
  )?.value as ReportReasonPrioritySetting | undefined
  const resolved = new Map<string, ResolvedReportPriority>()

  if (!levels || !mappings) return resolved

  for (const reportType of new Set(reportTypes)) {
    const level = Object.hasOwn(mappings, reportType)
      ? mappings[reportType]
      : undefined
    const config =
      level && Object.hasOwn(levels, level) ? levels[level] : undefined
    if (!level || !config) continue
    resolved.set(reportType, {
      level,
      score: config.score,
      targetResolutionMinutes: config.targetResolutionMinutes,
    })
  }

  return resolved
}
