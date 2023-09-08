export interface EmailToken {
  purpose:
    | 'confirm_email'
    | 'update_email'
    | 'reset_password'
    | 'delete_account'
  did: string
  token: string
  requestedAt: string
}

export const tableName = 'email_token'

export type PartialDB = { [tableName]: EmailToken }
