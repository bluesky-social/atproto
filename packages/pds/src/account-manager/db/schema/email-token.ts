export type EmailTokenPurpose =
  | 'confirm_email'
  | 'update_email'
  | 'reset_password'
  | 'delete_account'
  | 'plc_operation'

export interface EmailToken {
  purpose: EmailTokenPurpose
  did: string
  token: string
  requestedAt: string
}

export const tableName = 'email_token'

export type PartialDB = { [tableName]: EmailToken }
