import * as uint8arrays from 'uint8arrays'
import * as p256 from './p256/encoding'
import plugins from './plugins'

export const DID_KEY_BASE58_PREFIX = 'did:key:z'

export type ParsedDidKey = {
  jwtAlg: string
  keyBytes: Uint8Array
}

export const parseDidKey = (did: string): ParsedDidKey => {
  if (!did.startsWith(DID_KEY_BASE58_PREFIX)) {
    throw new Error(`Incorrect prefix for did:key: ${did}`)
  }
  const prefixedBytes = uint8arrays.fromString(
    did.slice(DID_KEY_BASE58_PREFIX.length),
    'base58btc',
  )
  const plugin = plugins.find((p) => hasPrefix(prefixedBytes, p.prefix))
  if (!plugin) {
    throw new Error('Unsupported key type')
  }
  let keyBytes = prefixedBytes.slice(plugin.prefix.length)
  if (plugin.jwtAlg === 'ES256') {
    keyBytes = p256.decompressPubkey(keyBytes)
  }
  return {
    jwtAlg: plugin.jwtAlg,
    keyBytes,
  }
}

const hasPrefix = (bytes: Uint8Array, prefix: Uint8Array): boolean => {
  return uint8arrays.equals(prefix, bytes.subarray(0, prefix.byteLength))
}
