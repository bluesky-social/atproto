import { tools } from '../lexicons/index.js'

export const APPEAL_REASON_TYPE = tools.ozone.report.defs.ReasonAppeal
export function isAppealReason(value: string): boolean {
  return value === APPEAL_REASON_TYPE
}
