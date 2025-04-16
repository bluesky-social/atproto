export const verificationTableName = 'verification'

export interface Verification {
  uri: string
  issuer: string
  subject: string
  handle: string
  displayName: string
  revokeReason: string | null
  revokedBy: string | null
  revokedAt: string | null
  createdAt: string
  updatedAt?: string
}

export type PartialDB = {
  [verificationTableName]: Verification
}
