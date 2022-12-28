export interface Signer {
  sign(msg: Uint8Array): Promise<Uint8Array>
}

export interface Didable {
  did(): string
}

export interface Keypair extends Signer, Didable {}

export type DidKeyPlugin = {
  prefix: Uint8Array
  jwtAlg: string
  verifySignature: (
    did: string,
    msg: Uint8Array,
    data: Uint8Array,
  ) => Promise<boolean>
}
