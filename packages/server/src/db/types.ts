import { AdxUri } from '@adxp/common'

export type DbPlugin<T> = {
  collection: string
  tableName: string
  get: (uri: AdxUri) => Promise<T | null>
  set: (uri: AdxUri, obj: unknown) => Promise<void>
  delete: (uri: AdxUri) => Promise<void>
}
