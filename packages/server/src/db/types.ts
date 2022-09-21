import { AdxUri } from '@adxp/common'
import { ValidationResult } from '@adxp/lexicon'

export type DbRecordPlugin<T, S> = {
  collection: string
  tableName: string
  get: (uri: AdxUri) => Promise<T | null>
  validateSchema: (obj: unknown) => ValidationResult
  set: (uri: AdxUri, obj: unknown) => Promise<void>
  delete: (uri: AdxUri) => Promise<void>
  translateDbObj: (dbObj: S) => T
}
