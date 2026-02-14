export interface NeuroProvisionNonce {
  nonce: string
  legalId: string
  createdAt: string
  expiresAt: string
}

export type PartialDB = {
  neuro_provision_nonce: NeuroProvisionNonce
}
