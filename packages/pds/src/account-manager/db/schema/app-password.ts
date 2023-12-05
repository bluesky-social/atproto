export interface AppPassword {
  did: string
  name: string
  passwordScrypt: string
  createdAt: string
}

export const tableName = 'app_password'

export type PartialDB = { [tableName]: AppPassword }
