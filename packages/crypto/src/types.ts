export interface Signer {
  jwtAlg: string
  sign(msg: Uint8Array): Promise<Uint8Array>
}

export interface Didable {
  did(): string
}

export interface Keypair extends Signer, Didable {}

export interface ExportableKeypair extends Keypair {
  export(): Promise<Uint8Array>
}

export type DidKeyPlugin = {
  prefix: Uint8Array
  jwtAlg: string
  verifySignature: (
    did: string,
    msg: Uint8Array,
    data: Uint8Array,
    opts?: VerifyOptions,
  ) => Promise<boolean>

  compressPubkey: (uncompressed: Uint8Array) => Uint8Array
  decompressPubkey: (compressed: Uint8Array) => Uint8Array
}

export type VerifyOptions = {
  allowMalleableSig?: boolean
}
