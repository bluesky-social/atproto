import { Migration } from 'kysely'
import * as init from './001-init'
import * as preorderMap from './002-preorder-map'

const migrations: Record<string, Migration> = {
  '001': init,
  '002': preorderMap,
}

export default migrations

// this is a getter so that it can be tweaked during testing
export function getLatestStoreSchemaVersion(): string {
  return Object.keys(migrations).sort().pop()!
}
