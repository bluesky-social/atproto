import {
  P256Keypair,
  P256_JWT_ALG,
  type ParsedMultikey,
  hkdfSha256,
  parseDidKey,
} from '@atproto/crypto'
import { ui8Concat } from '@atproto/lex-data'
import type { DidString } from '@atproto/syntax'
import { uint16be, utf8 } from './bytes.js'
import { SpaceKemError } from './error.js'

/**
 * The key encapsulation mechanism (KEM) that establishes the shared secret a
 * syncer and repo host use to MAC a response. This is ECDH on P-256, with the
 * secret derived as in DHKEM(P-256, HKDF-SHA256) from RFC 9180 §4.1.
 */

export type Encapsulation = {
  // The syncer's ephemeral public key as a did:key, sent as the `keyid` of its
  // MAC request.
  keyShare: DidString
  sharedSecret: Uint8Array
}

/**
 * Syncer side: generate a fresh ephemeral keypair and derive a shared secret
 * against the author's `#atproto_kem` key. Use a new one for every request.
 */
export async function encapsulate(
  authorKemKey: DidString,
): Promise<Encapsulation> {
  const authorKeyBytes = p256KeyBytes(authorKemKey)
  const ephemeral = await P256Keypair.create()
  const dh = ephemeral.ecdh(authorKeyBytes)
  const keyShare = ephemeral.did() as DidString
  const sharedSecret = deriveSharedSecret(
    dh,
    p256KeyBytes(keyShare),
    authorKeyBytes,
  )
  return { keyShare, sharedSecret }
}

/**
 * Repo host side: derive the same shared secret from the syncer's `keyShare`
 * using the author's KEM keypair.
 */
export function decapsulate(
  authorKemKeypair: P256Keypair,
  keyShare: DidString,
): Uint8Array {
  const syncerKeyBytes = p256KeyBytes(keyShare)
  const dh = authorKemKeypair.ecdh(syncerKeyBytes)
  return deriveSharedSecret(
    dh,
    syncerKeyBytes,
    p256KeyBytes(authorKemKeypair.did()),
  )
}

// Fixed labels from RFC 9180. 0x0010 identifies DHKEM(P-256, HKDF-SHA256).
const KEM_PREFIX = ui8Concat([utf8('HPKE-v1'), utf8('KEM'), uint16be(0x0010)])

function deriveSharedSecret(
  dh: Uint8Array,
  syncerKeyBytes: Uint8Array,
  authorKeyBytes: Uint8Array,
): Uint8Array {
  const input = ui8Concat([KEM_PREFIX, utf8('eae_prk'), dh])
  const info = ui8Concat([
    uint16be(32),
    KEM_PREFIX,
    utf8('shared_secret'),
    syncerKeyBytes,
    authorKeyBytes,
  ])
  return hkdfSha256(input, new Uint8Array(0), info, 32)
}

// The uncompressed public key (0x04 || x || y) for a P-256 did:key.
function p256KeyBytes(didKey: string): Uint8Array {
  let parsed: ParsedMultikey
  try {
    parsed = parseDidKey(didKey)
  } catch (cause) {
    throw new SpaceKemError('invalid KEM key', { cause })
  }
  if (parsed.jwtAlg !== P256_JWT_ALG) {
    throw new SpaceKemError('KEM key must be a P-256 did:key')
  }
  return parsed.keyBytes
}
