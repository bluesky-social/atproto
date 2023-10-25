import { randomStr } from '@atproto/crypto'
import * as scrypt from './scrypt'
import { AppPassword } from '../lexicon/types/com/atproto/server/createAppPassword'
import { AccountDb } from './db'
import { InvalidRequestError } from '@atproto/xrpc-server'

export const updateUserPassword = async (
  db: AccountDb,
  opts: {
    did: string
    passwordScrypt: string
  },
) => {
  await db.db
    .updateTable('account')
    .set({ passwordScrypt: opts.passwordScrypt })
    .where('did', '=', opts.did)
    .execute()
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
  const got = await db.db
    .insertInto('app_password')
    .values({
      did,
      name,
      passwordScrypt,
      createdAt: new Date().toISOString(),
    })
    .returningAll()
    .executeTakeFirst()
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
  await db.db
    .deleteFrom('app_password')
    .where('did', '=', did)
    .where('name', '=', name)
    .execute()
}
