import { Migration } from 'kysely'
import * as init from './001-init'

const migrations: Record<string, Migration> = {
  '001': init,
}

export default migrations

// this is a getter so that it can be tweaked during testing
export function getLatestStoreSchemaVersion(): string {
  return Object.keys(migrations).sort().pop()!
}
