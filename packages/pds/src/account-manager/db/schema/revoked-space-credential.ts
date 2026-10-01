import type { SpaceRefString } from '@atproto/lex'
import type { DateISO } from '../../../db/index.js'

export interface RevokedSpaceCredential {
  space: SpaceRefString
  jti: string
  expiresAt: DateISO
}

export const tableName = 'revoked_space_credential'

export type PartialDB = { [tableName]: RevokedSpaceCredential }
