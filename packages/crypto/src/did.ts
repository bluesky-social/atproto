import * as uint8arrays from 'uint8arrays'

import {
  BASE58_MULTIBASE_PREFIX,
  DID_KEY_PREFIX,
  P256_JWT_ALG,
  SECP256K1_JWT_ALG,
} from './const'
import * as p256 from './p256/encoding'
import plugins from './plugins'
import * as secp from './secp256k1/encoding'
import { extractMultikey, extractPrefixedBytes, hasPrefix } from './utils'

export type ParsedMultikey = {
  jwtAlg: string
  keyBytes: Uint8Array
}

export const parseMultikey = (multikey: string): ParsedMultikey => {
  const prefixedBytes = extractPrefixedBytes(multikey)
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

export const formatMultikey = (
  jwtAlg: string,
  keyBytes: Uint8Array,
): string => {
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
  return (
    BASE58_MULTIBASE_PREFIX + uint8arrays.toString(prefixedBytes, 'base58btc')
  )
}

export const parseDidKey = (did: string): ParsedMultikey => {
  const multikey = extractMultikey(did)
  return parseMultikey(multikey)
}

export const formatDidKey = (jwtAlg: string, keyBytes: Uint8Array): string => {
  return DID_KEY_PREFIX + formatMultikey(jwtAlg, keyBytes)
}
