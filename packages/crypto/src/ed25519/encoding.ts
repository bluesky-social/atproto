import { ed25519 } from '@noble/curves/ed25519'

export const compressPubkey = (pubkeyBytes: Uint8Array): Uint8Array => {
  return pubkeyBytes
}

export const decompressPubkey = (pubkeyBytes: Uint8Array): Uint8Array => {
  if (pubkeyBytes.length !== 32) {
    throw new Error('Expected 32 byte compress pubkey, actual length is ' + pubkeyBytes.length)
  }
  return pubkeyBytes
}
