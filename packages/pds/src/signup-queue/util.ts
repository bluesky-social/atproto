import Database from '../db'
import { countAll } from '../db/util'

export type LimiterFlags = {
  disableSignups: boolean
  periodAllowance: number
  periodMs: number
}

export type LimiterStatus = LimiterFlags & {
  accountsInPeriod: number
}

export const getRuntimeFlags = async (db: Database): Promise<LimiterFlags> => {
  const flagsRes = await db.db
    .selectFrom('runtime_flag')
    .selectAll()
    .where('name', '=', DISABLE_SIGNUPS_FLAG)
    .orWhere('name', '=', PERIOD_ALLOWANCE_FLAG)
    .orWhere('name', '=', PERIOD_MS_FLAG)
    .execute()
  const disableSignups =
    flagsRes.find((val) => val.name === DISABLE_SIGNUPS_FLAG)?.value ?? 'false'
  const periodAllowanceFlag =
    flagsRes.find((val) => val.name === PERIOD_ALLOWANCE_FLAG)?.value ??
    '10000000'
  const periodAllowance = parseInt(periodAllowanceFlag)
  const periodMsFlag =
    flagsRes.find((val) => val.name === PERIOD_MS_FLAG)?.value ?? '0'
  const periodMs = parseInt(periodMsFlag)

  return {
    disableSignups: disableSignups === 'true',
    periodAllowance: isNaN(periodAllowance) ? 10000000 : periodAllowance,
    periodMs: isNaN(periodMs) ? 10000000 : periodMs,
  }
}

export const getAccountsInPeriod = async (
  db: Database,
  periodMs: number,
): Promise<number> => {
  const periodStart = new Date(Date.now() - periodMs).toISOString()
  const res = await db.db
    .selectFrom('user_account')
    .select(countAll.as('count'))
    .where('activatedAt', 'is not', null)
    .where('activatedAt', '>', periodStart)
    .executeTakeFirstOrThrow()
  return res.count
}

export const getQueueStatus = async (db: Database) => {
  const flags = await getRuntimeFlags(db)
  const accountsInPeriod =
    flags.periodMs === 0 ? 0 : await getAccountsInPeriod(db, flags.periodMs)

  return {
    ...flags,
    accountsInPeriod,
  }
}

export const DISABLE_SIGNUPS_FLAG = 'signup-limiter:disableSignups'
export const PERIOD_ALLOWANCE_FLAG = 'signup-limiter:periodAllowance'
export const PERIOD_MS_FLAG = 'signup-limiter:periodMs'
