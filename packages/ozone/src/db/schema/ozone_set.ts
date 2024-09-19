import { Generated, GeneratedAlways } from 'kysely'

export const ozoneSetTableName = 'set_detail'
export const ozoneSetValueTableName = 'set_value'

export interface SetDetail {
  id: GeneratedAlways<number>
  name: string
  description: string | null
  createdAt: Generated<Date>
  updatedAt: Generated<Date>
}

export interface SetValue {
  id: GeneratedAlways<number>
  setId: number
  value: string
  createdAt: Generated<Date>
}

export type PartialDB = {
  [ozoneSetTableName]: SetDetail
  [ozoneSetValueTableName]: SetValue
}
