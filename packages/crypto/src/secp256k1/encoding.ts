import * as secp from '@noble/secp256k1'

export const compressPubkey = (pubkeyBytes: Uint8Array): Uint8Array => {
  const hex = secp.utils.bytesToHex(pubkeyBytes)
  const point = secp.Point.fromHex(hex)
  return point.toRawBytes(true)
}

export const decompressPubkey = (compressed: Uint8Array): Uint8Array => {
  if (compressed.length !== 33) {
    throw new Error('Expected 33 byte compress pubkey')
  }
  const hex = secp.utils.bytesToHex(compressed)
  const point = secp.Point.fromHex(hex)
  return point.toRawBytes(false)
}
