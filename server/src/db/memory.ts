import knex from 'knex'
import { Database } from './types'

const getMemoryDb = (): Database => {
  return knex({
    client: 'sqlite3',
    connection: {
      filename: ':memory:',
    },
  })
}

export default getMemoryDb
