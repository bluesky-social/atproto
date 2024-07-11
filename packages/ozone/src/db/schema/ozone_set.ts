import { Generated, GeneratedAlways } from 'kysely'

export const ozoneSetTableName = 'ozone_set'
export const ozoneSetValueTableName = 'ozone_set_value'

export interface OzoneSet {
  id: GeneratedAlways<number>
  name: string
  description: string | null
  createdAt: Generated<Date>
  updatedAt: Generated<Date>
}

export interface OzoneSetValue {
  id: GeneratedAlways<number>
  setId: number
  value: string
  createdAt: Generated<Date>
}

export type PartialDB = {
  [ozoneSetTableName]: OzoneSet
  [ozoneSetValueTableName]: OzoneSetValue
}
