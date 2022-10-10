import { sql } from 'kysely'
import crypto from 'crypto'

export const userWhereClause = (user: string) => {
  if (user.startsWith('did:')) {
    return sql<boolean>`user.did = ${user}`
  } else {
    return sql<boolean>`user.username = ${user}`
  }
}

export const isNotRepostClause = sql<boolean>`originator.did == post.creator`

export const postOrRepostIndexedAtClause = sql<string>`iif(${isNotRepostClause}, post.indexedAt, repost.indexedAt)`

// datetimes go to/from the database in the format 'YYYY-MM-DD HH:MM:SS'
// whereas ISO datetimes take the format 'YYYY-MM-DDTHH:MM:SSZ', so we convert.

// E.g. 2022-10-08 04:05:22.079 -> 2022-10-08T04:05:22.079Z
export const dateFromDb = (date: string) => {
  if (date.endsWith('Z') && date.includes('T')) {
    return date
  }
  return new Date(date + 'Z').toISOString()
}

// E.g. 2022-10-08T04:05:22.079Z -> 2022-10-08 04:05:22.079
export const dateToDb = (date: string) => {
  if (!date.endsWith('Z') && date.includes(' ')) {
    return date
  }
  return date.replace('T', ' ').replace(/Z$/, '')
}

export const scryptHash = (password: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex')
    crypto.scrypt(password, salt, 64, (err, hash) => {
      if (err) reject(err)
      resolve(salt + ':' + hash.toString('hex'))
    })
  })
}

export const scryptVerify = (
  password: string,
  storedHash: string,
): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const [salt, hash] = storedHash.split(':')
    crypto.scrypt(password, salt, 64, (err, derivedHash) => {
      if (err) reject(err)
      resolve(hash === derivedHash.toString('hex'))
    })
  })
}
