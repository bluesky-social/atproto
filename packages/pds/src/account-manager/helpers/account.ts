import { isErrUniqueViolation, notSoftDeletedClause } from '../../db'
import { AccountDb, AccountEntry, Actor, ActorEntry } from '../db'
import { StatusAttr } from '../../lexicon/types/com/atproto/admin/defs'
import { DAY } from '@atproto/common'
import { normalizeEmail } from './normalize-email'
import {
  Cursor,
  GenericKeyset,
  LabeledResult,
  paginate,
} from '../../db/pagination'
import { InvalidRequestError } from '@atproto/xrpc-server'

export class UserAlreadyExistsError extends Error {}

export type AccountSearchResult = Pick<
  AccountEntry,
  'did' | 'email' | 'normalizedEmail'
> &
  Pick<ActorEntry, 'handle'>

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
        normalizedEmail: normalizeEmail(email),
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
        .set({
          email: email.toLowerCase(),
          normalizedEmail: normalizeEmail(email),
          emailConfirmedAt: null,
        })
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

export const searchAccounts = async (
  db: AccountDb,
  {
    email,
    cursor,
    limit = 30,
  }: { email?: string; cursor?: string; limit?: number },
): Promise<{ accounts: AccountSearchResult[]; cursor?: string }> => {
  const query = db.db
    .selectFrom('account')
    .innerJoin('actor', 'account.did', 'actor.did')
    .select([
      'account.did',
      'account.email',
      'account.normalizedEmail',
      'actor.handle',
    ])
    .if(!!email, (qb) => {
      if (email?.startsWith('@')) {
        return qb.where(
          'account.normalizedEmail',
          'like',
          `%${email.toLowerCase()}`,
        )
      }
      // TODO: This is where we would want to search from a separate normalized email table
      return qb.where(
        'account.did',
        'in',
        db.db
          .selectFrom('account')
          .where('normalizedEmail', 'like', `%${email}%`)
          .select('did'),
      )
    })
  const { ref } = db.db.dynamic

  const keyset = new DidEmailKeyset(ref('account.did'), ref('account.email'))
  const paginatedQuery = paginate(query, {
    limit,
    cursor,
    keyset,
  })

  const results = await paginatedQuery.execute()
  return {
    accounts: results,
    cursor: keyset.packFromResult(results),
  }
}

type SearchAccountResult = { email: string; did: string }
export class DidEmailKeyset extends GenericKeyset<
  SearchAccountResult,
  LabeledResult
> {
  labelResult(result: SearchAccountResult): LabeledResult {
    return { primary: result.email, secondary: result.did }
  }
  labeledResultToCursor(labeled: Cursor) {
    return labeled
  }
  cursorToLabeledResult(cursor: Cursor) {
    const { primary } = cursor
    if (!primary) {
      throw new InvalidRequestError('Malformed cursor')
    }
    return cursor
  }
}
