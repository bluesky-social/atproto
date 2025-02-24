import { chunkArray } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { countAll } from '../../db'
import { AccountDb, InviteCode } from '../db'

export const createInviteCodes = async (
  db: AccountDb,
  toCreate: { account: string; codes: string[] }[],
  useCount: number,
) => {
  const now = new Date().toISOString()
  const rows = toCreate.flatMap((account) =>
    account.codes.map((code) => ({
      code: code,
      availableUses: useCount,
      disabled: 0 as const,
      forAccount: account.account,
      createdBy: 'admin',
      createdAt: now,
    })),
  )
  await Promise.all(
    chunkArray(rows, 50).map((chunk) =>
      db.executeWithRetry(db.db.insertInto('invite_code').values(chunk)),
    ),
  )
}

export const createAccountInviteCodes = async (
  db: AccountDb,
  forAccount: string,
  codes: string[],
  expectedTotal: number,
  disabled: 0 | 1,
): Promise<CodeDetail[]> => {
  const now = new Date().toISOString()
  const rows = codes.map(
    (code) =>
      ({
        code,
        availableUses: 1,
        disabled,
        forAccount,
        createdBy: forAccount,
        createdAt: now,
      }) as InviteCode,
  )
  await db.executeWithRetry(db.db.insertInto('invite_code').values(rows))

  const finalRoutineInviteCodes = await db.db
    .selectFrom('invite_code')
    .where('forAccount', '=', forAccount)
    .where('createdBy', '!=', 'admin') // dont count admin-gifted codes aginast the user
    .selectAll()
    .execute()
  if (finalRoutineInviteCodes.length > expectedTotal) {
    throw new InvalidRequestError(
      'attempted to create additional codes in another request',
      'DuplicateCreate',
    )
  }

  return rows.map((row) => ({
    ...row,
    available: 1,
    disabled: row.disabled === 1,
    uses: [],
  }))
}

export const recordInviteUse = async (
  db: AccountDb,
  opts: {
    did: string
    inviteCode: string | undefined
    now: string
  },
) => {
  if (!opts.inviteCode) return
  await db.executeWithRetry(
    db.db.insertInto('invite_code_use').values({
      code: opts.inviteCode,
      usedBy: opts.did,
      usedAt: opts.now,
    }),
  )
}

export const ensureInviteIsAvailable = async (
  db: AccountDb,
  inviteCode: string,
): Promise<void> => {
  const invite = await db.db
    .selectFrom('invite_code')
    .leftJoin('actor', 'actor.did', 'invite_code.forAccount')
    .where('takedownRef', 'is', null)
    .selectAll('invite_code')
    .where('code', '=', inviteCode)
    .executeTakeFirst()

  if (!invite || invite.disabled) {
    throw new InvalidRequestError(
      'Provided invite code not available',
      'InvalidInviteCode',
    )
  }

  const uses = await db.db
    .selectFrom('invite_code_use')
    .select(countAll.as('count'))
    .where('code', '=', inviteCode)
    .executeTakeFirstOrThrow()

  if (invite.availableUses <= uses.count) {
    throw new InvalidRequestError(
      'Provided invite code not available',
      'InvalidInviteCode',
    )
  }
}

export const selectInviteCodesQb = (db: AccountDb) => {
  const ref = db.db.dynamic.ref
  const builder = db.db
    .selectFrom('invite_code')
    .select([
      'invite_code.code as code',
      'invite_code.availableUses as available',
      'invite_code.disabled as disabled',
      'invite_code.forAccount as forAccount',
      'invite_code.createdBy as createdBy',
      'invite_code.createdAt as createdAt',
      db.db
        .selectFrom('invite_code_use')
        .select(countAll.as('count'))
        .whereRef('invite_code_use.code', '=', ref('invite_code.code'))
        .as('uses'),
    ])
  return db.db.selectFrom(builder.as('codes')).selectAll()
}

export const getAccountsInviteCodes = async (
  db: AccountDb,
  dids: string[],
): Promise<Map<string, CodeDetail[]>> => {
  const results = new Map<string, CodeDetail[]>()
  // We don't want to pass an empty array to kysely and let's avoid running a query entirely if there is nothing to match for
  if (!dids.length) return results
  const res = await selectInviteCodesQb(db)
    .where('forAccount', 'in', dids)
    .execute()
  const codes = res.map((row) => row.code)
  const uses = await getInviteCodesUses(db, codes)
  res.forEach((row) => {
    const existing = results.get(row.forAccount) ?? []
    results.set(row.forAccount, [
      ...existing,
      {
        ...row,
        uses: uses[row.code] ?? [],
        disabled: row.disabled === 1,
      },
    ])
  })
  return results
}

export const getInviteCodesUses = async (
  db: AccountDb,
  codes: string[],
): Promise<Record<string, CodeUse[]>> => {
  const uses: Record<string, CodeUse[]> = {}
  if (codes.length > 0) {
    const usesRes = await db.db
      .selectFrom('invite_code_use')
      .where('code', 'in', codes)
      .orderBy('usedAt', 'desc')
      .selectAll()
      .execute()
    for (const use of usesRes) {
      const { code, usedBy, usedAt } = use
      uses[code] ??= []
      uses[code].push({ usedBy, usedAt })
    }
  }
  return uses
}

export const getInvitedByForAccounts = async (
  db: AccountDb,
  dids: string[],
): Promise<Record<string, CodeDetail>> => {
  if (dids.length < 1) return {}
  const codeDetailsRes = await selectInviteCodesQb(db)
    .where('code', 'in', (qb) =>
      qb
        .selectFrom('invite_code_use')
        .where('usedBy', 'in', dids)
        .select('code')
        .distinct(),
    )
    .execute()
  const uses = await getInviteCodesUses(
    db,
    codeDetailsRes.map((row) => row.code),
  )
  const codeDetails = codeDetailsRes.map((row) => ({
    ...row,
    uses: uses[row.code] ?? [],
    disabled: row.disabled === 1,
  }))
  return codeDetails.reduce(
    (acc, cur) => {
      for (const use of cur.uses) {
        acc[use.usedBy] = cur
      }
      return acc
    },
    {} as Record<string, CodeDetail>,
  )
}

export const disableInviteCodes = async (
  db: AccountDb,
  opts: { codes: string[]; accounts: string[] },
) => {
  const { codes, accounts } = opts
  if (codes.length > 0) {
    await db.executeWithRetry(
      db.db
        .updateTable('invite_code')
        .set({ disabled: 1 })
        .where('code', 'in', codes),
    )
  }
  if (accounts.length > 0) {
    await db.executeWithRetry(
      db.db
        .updateTable('invite_code')
        .set({ disabled: 1 })
        .where('forAccount', 'in', accounts),
    )
  }
}

export const setAccountInvitesDisabled = async (
  db: AccountDb,
  did: string,
  disabled: boolean,
) => {
  await db.executeWithRetry(
    db.db
      .updateTable('account')
      .where('did', '=', did)
      .set({ invitesDisabled: disabled ? 1 : 0 }),
  )
}

export type CodeDetail = {
  code: string
  available: number
  disabled: boolean
  forAccount: string
  createdBy: string
  createdAt: string
  uses: CodeUse[]
}

type CodeUse = {
  usedBy: string
  usedAt: string
}
