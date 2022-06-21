import { webcrypto } from 'one-webcrypto'
import { pubkeyFromDid } from './util.js'

export const verifyEcdsaSig = async (
  data: Uint8Array,
  sig: Uint8Array,
  did: string,
): Promise<boolean> => {
  try {
    const publicKey = await pubkeyFromDid(did, true)
    return webcrypto.subtle.verify(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      publicKey,
      sig,
      data,
    )
  } catch (err) {
    console.log(err)
    throw err
  }
}
