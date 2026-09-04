export interface SpaceCredentialRecipient {
  space: string
  serviceDid: string
  serviceEndpoint: string
  // Stored rather than derived, so reads are a plain comparison against now.
  expiresAt: string
}

const tableName = 'space_credential_recipient'

export type PartialDB = { [tableName]: SpaceCredentialRecipient }
