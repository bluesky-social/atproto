import crypto from 'crypto'
import { EntityTarget, SelectQueryBuilder } from 'typeorm'

export const collectionToTableName = (collection: string): string => {
  return `record_${collection.split('.').join('_')}`
}

export const userWhereClause = (user: string): string => {
  if (user.startsWith('did:')) {
    return 'user.did = :user'
  } else {
    return 'user.username = :user'
  }
}

export const isNotRepostClause = 'originator.did == post.creator'

export const postOrRepostIndexedAtClause = `iif(${isNotRepostClause}, post.indexedAt, repost.indexedAt)`

type Subquery = (qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>

export const countSubquery = (
  table: EntityTarget<any>,
  subject: string,
): Subquery => {
  return (subquery: SelectQueryBuilder<any>) => {
    return subquery
      .select([`table.${subject} AS subject`, 'COUNT(table.uri) as count'])
      .from(table, 'table')
      .groupBy(`table.${subject}`)
  }
}

export const existsByCreatorSubquery = (
  table: EntityTarget<any>,
  subject: string,
  creator: string,
): Subquery => {
  return (subquery: SelectQueryBuilder<any>) => {
    return subquery
      .select([`table.${subject} AS subject`, 'COUNT(table.uri) as doesExist'])
      .from(table, 'table')
      .where('table.creator = :creator', { creator })
  }
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
