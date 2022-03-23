import knex from 'knex'
import { Database } from './types'

const getPersistentDb = (location: string): Database => {
  return knex({
    client: 'sqlite3',
    connection: {
      filename: location,
    },
  })
}

export default getPersistentDb
