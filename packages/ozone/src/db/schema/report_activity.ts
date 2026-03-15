import { Generated } from 'kysely'

export const reportActivityTableName = 'report_activity'

export interface ReportActivity {
  id: Generated<number>
  reportId: number
  action: string // 'status_change' | 'note'
  fromState: string | null // previous status, only set for status_change actions
  toState: string | null // new status, only set for status_change actions
  note: string | null
  meta: unknown | null
  isAutomated: boolean
  createdBy: string // DID of actor (or service DID for automated activities)
  createdAt: string // ISO string
}

export type PartialDB = {
  [reportActivityTableName]: ReportActivity
}
