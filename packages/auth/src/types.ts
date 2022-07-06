export interface Signer {
  sign: (data: Uint8Array) => Promise<Uint8Array>
}
