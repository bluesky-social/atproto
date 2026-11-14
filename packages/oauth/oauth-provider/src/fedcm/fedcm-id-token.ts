import type { Did } from '@atproto/did'
import type { ClientId } from '../client/client-id.js'

export const FEDCM_ID_TOKEN_TYP = 'atproto-id+jwt'
/** Lifetime of a FedCM id token, in seconds. */
export const FEDCM_ID_TOKEN_LIFETIME = 60

/**
 * Signs with an account's atproto signing key. Structurally matches the
 * `Keypair` of `@atproto/crypto`, which this package does not depend on.
 */
export type AccountSigner = {
  jwtAlg: string
  sign(data: Uint8Array): Promise<Uint8Array>
}

export type FedcmIdTokenInput = {
  did: Did
  clientId: ClientId
  nonce: string
  /** The time at which the user last authenticated. */
  authTime: Date
  now?: Date
}

const encoder = new TextEncoder()

function base64url(input: string | Uint8Array): string {
  return Buffer.from(
    typeof input === 'string' ? encoder.encode(input) : input,
  ).toString('base64url')
}

const toSeconds = (date: Date) => Math.floor(date.getTime() / 1000)

export async function createFedcmIdToken(
  signer: AccountSigner,
  { did, clientId, nonce, authTime, now = new Date() }: FedcmIdTokenInput,
): Promise<string> {
  const iat = toSeconds(now)
  const header = base64url(
    JSON.stringify({
      typ: FEDCM_ID_TOKEN_TYP,
      alg: signer.jwtAlg,
      kid: `${did}#atproto`,
    }),
  )
  const payload = base64url(
    JSON.stringify({
      iss: did,
      sub: did,
      aud: clientId,
      nonce,
      iat,
      exp: iat + FEDCM_ID_TOKEN_LIFETIME,
      auth_time: toSeconds(authTime),
    }),
  )
  const signingInput = `${header}.${payload}`
  const signature = await signer.sign(encoder.encode(signingInput))
  return `${signingInput}.${base64url(signature)}`
}
