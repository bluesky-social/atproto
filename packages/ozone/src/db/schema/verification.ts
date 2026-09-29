import type { Generated } from 'kysely'
import type {
  AtUriString,
  DatetimeString,
  DidString,
  HandleString,
} from '@atproto/lex'

export const verificationTableName = 'verification'

export interface Verification {
  uri: AtUriString
  cid: string
  issuer: DidString
  subject: DidString
  handle: HandleString
  displayName: string
  revokeReason: string | null
  revokedBy: DidString | null
  revokedAt: DatetimeString | null
  createdAt: DatetimeString
  updatedAt: Generated<DatetimeString>
}

export type PartialDB = {
  [verificationTableName]: Verification
}
