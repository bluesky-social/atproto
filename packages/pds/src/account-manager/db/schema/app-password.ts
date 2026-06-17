import { DatetimeString } from '@atproto/lex'

export interface AppPassword {
  did: string
  name: string
  passwordScrypt: string
  createdAt: DatetimeString
  privileged: 0 | 1
}

export const tableName = 'app_password'

export type PartialDB = { [tableName]: AppPassword }
