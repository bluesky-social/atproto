import { GeneratedAlways } from 'kysely'

export interface AppPassword {
  accountDid: string
  passwordScrypt: string
  name: string
  createdAt: GeneratedAlways<string>
}

export const tableName = 'app_password'

export type PartialDB = { [tableName]: AppPassword }
