import { AdxUri } from '@adxp/common'

export type DbPlugin<T, S> = {
  collection: string
  tableName: string
  get: (uri: AdxUri) => Promise<T | null>
  getMany: (uris: AdxUri[] | string[]) => Promise<T[]>
  set: (uri: AdxUri, obj: unknown) => Promise<void>
  delete: (uri: AdxUri) => Promise<void>
  translateDbObj: (dbObj: S) => T
}

export type ViewFn = (params: Record<string, unknown>) => unknown
