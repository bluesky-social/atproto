import {
  P256Keypair,
  P256_JWT_ALG,
  type ParsedMultikey,
  hkdfExpandSha256,
  hkdfExtractSha256,
  parseDidKey,
} from '@atproto/crypto'
import { ui8Concat } from '@atproto/lex-data'
import type { DidString } from '@atproto/syntax'
import { uint16be, utf8 } from './bytes.js'
import { SpaceKemError } from './error.js'

/**
 * Establishes the shared secret a syncer and repo host use to MAC a response,
 * with the secret export feature of HPKE (RFC 9180 §6.2). The ciphersuite is
 * DHKEM(P-256, HKDF-SHA256) with HKDF-SHA256 and the Export-only AEAD, so
 * nothing is encrypted.
 *
 * Rather than depend on an HPKE library, this spells out the ECDH and HKDF steps
 * that HPKE performs for that one ciphersuite.
 */

export type Encapsulation = {
  // HPKE's `enc`: the syncer's ephemeral public key as a did:key, sent as the
  // `keyid` of its MAC request.
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
  const enc = p256KeyBytes(keyShare)
  const dh = authorKemKeypair.ecdh(enc)
  return deriveSharedSecret(dh, enc, p256KeyBytes(authorKemKeypair.did()))
}

// A fixed label tying the secret to this protocol.
const HPKE_INFO = utf8('atproto-space-mac')

// HPKE labels every HKDF input with a version and the IDs of the algorithms in
// use: 0x0010 is DHKEM(P-256, HKDF-SHA256), 0x0001 is HKDF-SHA256, and 0xffff
// is the Export-only AEAD.
const HPKE_VERSION = utf8('HPKE-v1')
const KEM_ID = ui8Concat([utf8('KEM'), uint16be(0x0010)])
const SUITE_ID = ui8Concat([
  utf8('HPKE'),
  uint16be(0x0010),
  uint16be(0x0001),
  uint16be(0xffff),
])

const MODE_BASE = new Uint8Array([0x00])
const EMPTY = new Uint8Array(0)

// HPKE's SetupBaseS (or SetupBaseR) followed by an export with an empty
// exporter context, given the ECDH result `dh`.
function deriveSharedSecret(
  dh: Uint8Array,
  enc: Uint8Array,
  authorKeyBytes: Uint8Array,
): Uint8Array {
  // The KEM's secret, from the ECDH result and both public keys.
  const eaePrk = labeledExtract(KEM_ID, EMPTY, 'eae_prk', dh)
  const kemSecret = labeledExpand(
    KEM_ID,
    eaePrk,
    'shared_secret',
    ui8Concat([enc, authorKeyBytes]),
    32,
  )

  // The key schedule, in base mode with no pre-shared key.
  const pskIdHash = labeledExtract(SUITE_ID, EMPTY, 'psk_id_hash', EMPTY)
  const infoHash = labeledExtract(SUITE_ID, EMPTY, 'info_hash', HPKE_INFO)
  const context = ui8Concat([MODE_BASE, pskIdHash, infoHash])
  const secret = labeledExtract(SUITE_ID, kemSecret, 'secret', EMPTY)
  const exporterSecret = labeledExpand(SUITE_ID, secret, 'exp', context, 32)

  return labeledExpand(SUITE_ID, exporterSecret, 'sec', EMPTY, 32)
}

function labeledExtract(
  id: Uint8Array,
  salt: Uint8Array,
  label: string,
  ikm: Uint8Array,
): Uint8Array {
  return hkdfExtractSha256(
    salt,
    ui8Concat([HPKE_VERSION, id, utf8(label), ikm]),
  )
}

function labeledExpand(
  id: Uint8Array,
  prk: Uint8Array,
  label: string,
  info: Uint8Array,
  length: number,
): Uint8Array {
  return hkdfExpandSha256(
    prk,
    ui8Concat([uint16be(length), HPKE_VERSION, id, utf8(label), info]),
    length,
  )
}

// The uncompressed public key (0x04 || x || y) for a P-256 did:key. HPKE encodes
// keys uncompressed, even though did:key uses the compressed form.
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
