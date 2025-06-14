import { Selectable } from "kysely"

export interface AuthCallback {
  state: string,
  scope: string,
  nonce: string,
  idpId: string
  redirectUri: string,
  codeVerifier: string | null,
}

export type AuthCallbackEntry = Selectable<AuthCallback>

export const tableName = 'auth_callback'

export type PartialDB = { [tableName]: AuthCallback }
