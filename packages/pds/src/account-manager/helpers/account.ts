import { notSoftDeletedClause } from '../../db'
import { AccountDb, AccountEntry } from '../db'
import { StatusAttr } from '../../lexicon/types/com/atproto/admin/defs'

export const getAccount = async (
  db: AccountDb,
  handleOrDid: string,
  includeSoftDeleted = false,
): Promise<AccountEntry | null> => {
  const { ref } = db.db.dynamic
  const result = await db.db
    .selectFrom('account')
    .if(!includeSoftDeleted, (qb) =>
      qb.where(notSoftDeletedClause(ref('account'))),
    )
    .where((qb) => {
      if (handleOrDid.startsWith('did:')) {
        return qb.where('account.did', '=', handleOrDid)
      } else {
        return qb.where('account.handle', '=', handleOrDid)
      }
    })
    .selectAll()
    .executeTakeFirst()
  return result || null
}

export const getAccountByEmail = async (
  db: AccountDb,
  email: string,
  includeSoftDeleted = false,
): Promise<AccountEntry | null> => {
  const { ref } = db.db.dynamic
  const found = await db.db
    .selectFrom('account')
    .if(!includeSoftDeleted, (qb) =>
      qb.where(notSoftDeletedClause(ref('account'))),
    )
    .where('email', '=', email.toLowerCase())
    .selectAll('account')
    .executeTakeFirst()
  return found || null
}

export const registerAccount = async (
  db: AccountDb,
  opts: {
    did: string
    handle: string
    email: string
    passwordScrypt: string
  },
) => {
  const { did, handle, email, passwordScrypt } = opts
  const registered = await db.db
    .insertInto('account')
    .values({
      email: email.toLowerCase(),
      did,
      handle,
      passwordScrypt,
      createdAt: new Date().toISOString(),
    })
    .onConflict((oc) => oc.doNothing())
    .returning('did')
    .executeTakeFirst()

  if (!registered) {
    throw new Error('user already exists')
  }
}

export const deleteAccount = async (
  db: AccountDb,
  did: string,
): Promise<void> => {
  // Not done in transaction because it would be too long, prone to contention.
  // Also, this can safely be run multiple times if it fails.
  await db.db.deleteFrom('repo_root').where('did', '=', did).execute()
  await db.db.deleteFrom('email_token').where('did', '=', did).execute()
  await db.db.deleteFrom('refresh_token').where('did', '=', did).execute()
  await db.db.deleteFrom('account').where('account.did', '=', did).execute()
}

export const updateHandle = async (
  db: AccountDb,
  did: string,
  handle: string,
) => {
  const res = await db.db
    .updateTable('account')
    .set({ handle })
    .where('did', '=', did)
    .whereNotExists(
      db.db.selectFrom('account').where('handle', '=', handle).selectAll(),
    )
    .executeTakeFirst()
  if (res.numUpdatedRows < 1) {
    throw new Error('user already exists')
  }
}

export const updateEmail = async (
  db: AccountDb,
  did: string,
  email: string,
) => {
  await db.db
    .updateTable('account')
    .set({ email: email.toLowerCase(), emailConfirmedAt: null })
    .where('did', '=', did)
    .executeTakeFirst()
}

export const setEmailConfirmedAt = async (
  db: AccountDb,
  did: string,
  emailConfirmedAt: string,
) => {
  await db.db
    .updateTable('account')
    .set({ emailConfirmedAt })
    .where('did', '=', did)
    .execute()
}

export const getAccountTakedownStatus = async (
  db: AccountDb,
  did: string,
): Promise<StatusAttr | null> => {
  const res = await db.db
    .selectFrom('account')
    .select('takedownId')
    .where('did', '=', did)
    .executeTakeFirst()
  if (!res) return null
  return res.takedownId
    ? { applied: true, ref: res.takedownId }
    : { applied: false }
}

export const updateAccountTakedownStatus = async (
  db: AccountDb,
  did: string,
  takedown: StatusAttr,
) => {
  const takedownId = takedown.applied
    ? takedown.ref ?? new Date().toISOString()
    : null
  await db.db
    .updateTable('account')
    .set({ takedownId })
    .where('did', '=', did)
    .executeTakeFirst()
}
