import { AdxUri } from '@adxp/common'
import { DataSource } from 'typeorm'
import { AdxValidationResult } from '@adxp/schemas'

export type DbRecordPlugin<T, S> = {
  collection: string
  tableName: string
  get: (uri: AdxUri) => Promise<T | null>
  validateSchema: (obj: unknown) => AdxValidationResult
  set: (uri: AdxUri, obj: unknown) => Promise<void>
  delete: (uri: AdxUri) => Promise<void>
  translateDbObj: (dbObj: S) => T
}

export type DbViewPlugin = {
  id: string
  fn: (db: DataSource) => ViewFn
}

export type ViewFn = (
  params: Record<string, unknown>,
  requesterDid: string,
) => unknown
