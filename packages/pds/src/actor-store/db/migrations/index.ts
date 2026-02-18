import * as init from './001-init'

const migrations = {
  '001': init,
}

export default migrations

const migrationKeys = Object.keys(migrations)
export const LATEST_STORE_SCHEMA_VERSION =
  migrationKeys[migrationKeys.length - 1]
