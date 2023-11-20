import { randomStr } from '@atproto/crypto'
import { InvalidRequestError } from '@atproto/xrpc-server'
import * as scrypt from './scrypt'
import { AccountDb } from '../db'
import { AppPassword } from '../../lexicon/types/com/atproto/server/createAppPassword'

export const verifyAccountPassword = async (
  db: AccountDb,
  did: string,
  password: string,
): Promise<boolean> => {
  const found = await db.db
    .selectFrom('account')
    .selectAll()
    .where('did', '=', did)
    .executeTakeFirst()
  return found ? await scrypt.verify(password, found.passwordScrypt) : false
}

export const verifyAppPassword = async (
  db: AccountDb,
  did: string,
  password: string,
): Promise<string | null> => {
  const passwordScrypt = await scrypt.hashAppPassword(did, password)
  const found = await db.db
    .selectFrom('app_password')
    .selectAll()
    .where('did', '=', did)
    .where('passwordScrypt', '=', passwordScrypt)
    .executeTakeFirst()
  return found?.name ?? null
}

export const updateUserPassword = async (
  db: AccountDb,
  opts: {
    did: string
    passwordScrypt: string
  },
) => {
  await db.executeWithRetry(
    db.db
      .updateTable('account')
      .set({ passwordScrypt: opts.passwordScrypt })
      .where('did', '=', opts.did),
  )
}

export const createAppPassword = async (
  db: AccountDb,
  did: string,
  name: string,
): Promise<AppPassword> => {
  // create an app password with format:
  // 1234-abcd-5678-efgh
  const str = randomStr(16, 'base32').slice(0, 16)
  const chunks = [
    str.slice(0, 4),
    str.slice(4, 8),
    str.slice(8, 12),
    str.slice(12, 16),
  ]
  const password = chunks.join('-')
  const passwordScrypt = await scrypt.hashAppPassword(did, password)
  const [got] = await db.executeWithRetry(
    db.db
      .insertInto('app_password')
      .values({
        did,
        name,
        passwordScrypt,
        createdAt: new Date().toISOString(),
      })
      .returningAll(),
  )
  if (!got) {
    throw new InvalidRequestError('could not create app-specific password')
  }
  return {
    name,
    password,
    createdAt: got.createdAt,
  }
}

export const listAppPasswords = async (
  db: AccountDb,
  did: string,
): Promise<{ name: string; createdAt: string }[]> => {
  return db.db
    .selectFrom('app_password')
    .select(['name', 'createdAt'])
    .where('did', '=', did)
    .execute()
}

export const deleteAppPassword = async (
  db: AccountDb,
  did: string,
  name: string,
) => {
  await db.executeWithRetry(
    db.db
      .deleteFrom('app_password')
      .where('did', '=', did)
      .where('name', '=', name),
  )
}
