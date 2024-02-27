import { isErrUniqueViolation, notSoftDeletedClause } from '../../db'
import { AccountDb, ActorEntry } from '../db'
import { StatusAttr } from '../../lexicon/types/com/atproto/admin/defs'
import { DAY } from '@atproto/common'

export class UserAlreadyExistsError extends Error {}

export type ActorAccount = ActorEntry & {
  email: string | null
  emailConfirmedAt: string | null
  invitesDisabled: 0 | 1 | null
}

export type AvailabilityFlags = {
  includeTakenDown?: boolean
  includeDeactivated?: boolean
}

const selectAccountQB = (db: AccountDb, flags?: AvailabilityFlags) => {
  const { includeTakenDown = false, includeDeactivated = false } = flags ?? {}
  const { ref } = db.db.dynamic
  return db.db
    .selectFrom('actor')
    .leftJoin('account', 'actor.did', 'account.did')
    .if(!includeTakenDown, (qb) => qb.where(notSoftDeletedClause(ref('actor'))))
    .if(!includeDeactivated, (qb) =>
      qb.where('actor.deactivatedAt', 'is', null),
    )
    .select([
      'actor.did',
      'actor.handle',
      'actor.createdAt',
      'actor.takedownRef',
      'actor.deactivatedAt',
      'actor.deleteAfter',
      'account.email',
      'account.emailConfirmedAt',
      'account.invitesDisabled',
    ])
}

export const getAccount = async (
  db: AccountDb,
  handleOrDid: string,
  flags?: AvailabilityFlags,
): Promise<ActorAccount | null> => {
  const found = await selectAccountQB(db, flags)
    .where((qb) => {
      if (handleOrDid.startsWith('did:')) {
        return qb.where('actor.did', '=', handleOrDid)
      } else {
        return qb.where('actor.handle', '=', handleOrDid)
      }
    })
    .executeTakeFirst()
  return found || null
}

export const getAccountByEmail = async (
  db: AccountDb,
  email: string,
  flags?: AvailabilityFlags,
): Promise<ActorAccount | null> => {
  const found = await selectAccountQB(db, flags)
    .where('email', '=', email.toLowerCase())
    .executeTakeFirst()
  return found || null
}

export const registerActor = async (
  db: AccountDb,
  opts: {
    did: string
    handle: string
    deactivated?: boolean
  },
) => {
  const { did, handle, deactivated } = opts
  const now = Date.now()
  const createdAt = new Date(now).toISOString()
  const [registered] = await db.executeWithRetry(
    db.db
      .insertInto('actor')
      .values({
        did,
        handle,
        createdAt,
        deactivatedAt: deactivated ? createdAt : null,
        deleteAfter: deactivated ? new Date(now + 3 * DAY).toISOString() : null,
      })
      .onConflict((oc) => oc.doNothing())
      .returning('did'),
  )
  if (!registered) {
    throw new UserAlreadyExistsError()
  }
}

export const registerAccount = async (
  db: AccountDb,
  opts: {
    did: string
    email: string
    passwordScrypt: string
  },
) => {
  const { did, email, passwordScrypt } = opts
  const [registered] = await db.executeWithRetry(
    db.db
      .insertInto('account')
      .values({
        did,
        email: email.toLowerCase(),
        passwordScrypt,
      })
      .onConflict((oc) => oc.doNothing())
      .returning('did'),
  )
  if (!registered) {
    throw new UserAlreadyExistsError()
  }
}

export const deleteAccount = async (
  db: AccountDb,
  did: string,
): Promise<void> => {
  // Not done in transaction because it would be too long, prone to contention.
  // Also, this can safely be run multiple times if it fails.
  await db.executeWithRetry(
    db.db.deleteFrom('repo_root').where('did', '=', did),
  )
  await db.executeWithRetry(
    db.db.deleteFrom('email_token').where('did', '=', did),
  )
  await db.executeWithRetry(
    db.db.deleteFrom('refresh_token').where('did', '=', did),
  )
  await db.executeWithRetry(
    db.db.deleteFrom('account').where('account.did', '=', did),
  )
  await db.executeWithRetry(
    db.db.deleteFrom('actor').where('actor.did', '=', did),
  )
}

export const updateHandle = async (
  db: AccountDb,
  did: string,
  handle: string,
) => {
  const [res] = await db.executeWithRetry(
    db.db
      .updateTable('actor')
      .set({ handle })
      .where('did', '=', did)
      .whereNotExists(
        db.db.selectFrom('actor').where('handle', '=', handle).selectAll(),
      ),
  )
  if (res.numUpdatedRows < 1) {
    throw new UserAlreadyExistsError()
  }
}

export const updateEmail = async (
  db: AccountDb,
  did: string,
  email: string,
) => {
  try {
    await db.executeWithRetry(
      db.db
        .updateTable('account')
        .set({ email: email.toLowerCase(), emailConfirmedAt: null })
        .where('did', '=', did),
    )
  } catch (err) {
    if (isErrUniqueViolation(err)) {
      throw new UserAlreadyExistsError()
    }
    throw err
  }
}

export const setEmailConfirmedAt = async (
  db: AccountDb,
  did: string,
  emailConfirmedAt: string,
) => {
  await db.executeWithRetry(
    db.db
      .updateTable('account')
      .set({ emailConfirmedAt })
      .where('did', '=', did),
  )
}

export const getAccountTakedownStatus = async (
  db: AccountDb,
  did: string,
): Promise<StatusAttr | null> => {
  const res = await db.db
    .selectFrom('actor')
    .select('takedownRef')
    .where('did', '=', did)
    .executeTakeFirst()
  if (!res) return null
  return res.takedownRef
    ? { applied: true, ref: res.takedownRef }
    : { applied: false }
}

export const updateAccountTakedownStatus = async (
  db: AccountDb,
  did: string,
  takedown: StatusAttr,
) => {
  const takedownRef = takedown.applied
    ? takedown.ref ?? new Date().toISOString()
    : null
  await db.executeWithRetry(
    db.db.updateTable('actor').set({ takedownRef }).where('did', '=', did),
  )
}

export const deactivateAccount = async (
  db: AccountDb,
  did: string,
  deleteAfter: string | null,
) => {
  await db.executeWithRetry(
    db.db
      .updateTable('actor')
      .set({
        deactivatedAt: new Date().toISOString(),
        deleteAfter,
      })
      .where('did', '=', did),
  )
}

export const activateAccount = async (db: AccountDb, did: string) => {
  await db.executeWithRetry(
    db.db
      .updateTable('actor')
      .set({
        deactivatedAt: null,
        deleteAfter: null,
      })
      .where('did', '=', did),
  )
}
