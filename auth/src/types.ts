import ucan from 'ucans'

export interface Signer {
  sign: (data: Uint8Array) => Promise<Uint8Array>
}

export interface Keypair extends ucan.Keypair, ucan.Didable {}
