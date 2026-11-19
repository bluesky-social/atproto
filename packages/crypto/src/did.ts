import * as uint8arrays from 'uint8arrays'
import {
  BASE58_MULTIBASE_PREFIX,
  DID_KEY_PREFIX,
  P256_JWT_ALG,
  SECP256K1_JWT_ALG,
} from './const.js'
import { multibaseToBytes } from './multibase.js'
import { plugins } from './plugins.js'
import { extractMultikey, extractPrefixedBytes, hasPrefix } from './utils.js'

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
  const keyBytes = plugin.decompressPubkey(
    prefixedBytes.slice(plugin.prefix.length),
  )
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
  const prefixedBytes = uint8arrays.concat([
    plugin.prefix,
    plugin.compressPubkey(keyBytes),
  ])
  return (
    BASE58_MULTIBASE_PREFIX + uint8arrays.toString(prefixedBytes, 'base58btc')
  )
}

export const parseDidKey = (did: string): ParsedMultikey => {
  const multikey = extractMultikey(did)
  return parseMultikey(multikey)
}

export type DidKey = `did:key:${string}`
export function formatDidKey(jwtAlg: string, keyBytes: Uint8Array): DidKey {
  return `${DID_KEY_PREFIX}${formatMultikey(jwtAlg, keyBytes)}` as const
}

export function formatDidVerificationMethod(key: {
  type: string
  publicKeyMultibase: string
}): DidKey {
  switch (key.type) {
    case 'EcdsaSecp256r1VerificationKey2019': {
      const keyBytes = multibaseToBytes(key.publicKeyMultibase)
      return formatDidKey(P256_JWT_ALG, keyBytes)
    }
    case 'EcdsaSecp256k1VerificationKey2019': {
      const keyBytes = multibaseToBytes(key.publicKeyMultibase)
      return formatDidKey(SECP256K1_JWT_ALG, keyBytes)
    }
    case 'Multikey': {
      const { jwtAlg, keyBytes } = parseMultikey(key.publicKeyMultibase)
      return formatDidKey(jwtAlg, keyBytes)
    }
    default: {
      throw new Error(`Unsupported verification method type: ${key.type}`)
    }
  }
}
