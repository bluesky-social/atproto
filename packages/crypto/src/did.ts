import * as uint8arrays from 'uint8arrays'
import * as p256 from './p256/encoding'
import * as secp from './secp256k1/encoding'
import plugins from './plugins'
import { P256_JWT_ALG, SECP256K1_JWT_ALG, BASE58_DID_PREFIX } from './const'

export type ParsedDidKey = {
  jwtAlg: string
  keyBytes: Uint8Array
}

export const parseDidKey = (did: string): ParsedDidKey => {
  if (!did.startsWith(BASE58_DID_PREFIX)) {
    throw new Error(`Incorrect prefix for did:key: ${did}`)
  }
  const prefixedBytes = uint8arrays.fromString(
    did.slice(BASE58_DID_PREFIX.length),
    'base58btc',
  )
  const plugin = plugins.find((p) => hasPrefix(prefixedBytes, p.prefix))
  if (!plugin) {
    throw new Error('Unsupported key type')
  }
  let keyBytes = prefixedBytes.slice(plugin.prefix.length)
  if (plugin.jwtAlg === P256_JWT_ALG) {
    keyBytes = p256.decompressPubkey(keyBytes)
  } else if (plugin.jwtAlg === SECP256K1_JWT_ALG) {
    keyBytes = secp.decompressPubkey(keyBytes)
  }
  return {
    jwtAlg: plugin.jwtAlg,
    keyBytes,
  }
}

export const formatDidKey = (jwtAlg: string, keyBytes: Uint8Array): string => {
  const plugin = plugins.find((p) => p.jwtAlg === jwtAlg)
  if (!plugin) {
    throw new Error('Unsupported key type')
  }
  if (jwtAlg === P256_JWT_ALG) {
    keyBytes = p256.compressPubkey(keyBytes)
  } else if (jwtAlg === SECP256K1_JWT_ALG) {
    keyBytes = secp.compressPubkey(keyBytes)
  }
  const prefixedBytes = uint8arrays.concat([plugin.prefix, keyBytes])
  return BASE58_DID_PREFIX + uint8arrays.toString(prefixedBytes, 'base58btc')
}

const hasPrefix = (bytes: Uint8Array, prefix: Uint8Array): boolean => {
  return uint8arrays.equals(prefix, bytes.subarray(0, prefix.byteLength))
}
