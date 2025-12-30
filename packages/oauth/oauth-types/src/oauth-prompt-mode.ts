import { z } from 'zod'

/**
 * - "none" will only be allowed if the user already allowed the client on the same device
 * - "login" will force the user to login again, unless he very recently logged in
 * - "consent" will force the user to consent again
 * - "select_account" will force the user to select an account
 * - "create" will force the user registration screen
 */
export const oauthPromptModeSchema = z.enum([
  'none',
  'login',
  'consent',
  'select_account',
  'create',
])

export type OAuthPromptMode = z.infer<typeof oauthPromptModeSchema>
