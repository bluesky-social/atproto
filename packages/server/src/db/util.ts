import { EntityTarget, SelectQueryBuilder } from 'typeorm'

export const collectionToTableName = (collection: string): string => {
  return `record_${collection.split('/').join('_')}`
}

export const userWhereClause = (user: string): string => {
  if (user.startsWith('did:')) {
    return 'user.did = :user'
  } else {
    return 'user.username = :user'
  }
}

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
