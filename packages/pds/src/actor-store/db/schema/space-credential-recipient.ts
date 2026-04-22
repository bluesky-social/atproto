export interface SpaceCredentialRecipient {
  space: string
  serviceDid: string
  serviceEndpoint: string
  lastIssuedAt: string
}

const tableName = 'space_credential_recipient'

export type PartialDB = { [tableName]: SpaceCredentialRecipient }
