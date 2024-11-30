export interface AppPassword {
  did: string
  name: string
  passwordScrypt: string
  createdAt: string
  privileged: 0 | 1
}

export const tableName = 'app_password'

export type PartialDB = { [tableName]: AppPassword }
