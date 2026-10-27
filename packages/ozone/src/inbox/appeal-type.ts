import { com, tools } from '../lexicons/index.js'

export const APPEAL_REASON_TYPE = tools.ozone.report.defs.ReasonAppeal
export const APPEAL_REASON_TYPES = [
  APPEAL_REASON_TYPE,
  com.atproto.moderation.defs.ReasonAppeal,
] as const

export function isAppealReason(value: string): boolean {
  return (APPEAL_REASON_TYPES as readonly string[]).includes(value)
}
