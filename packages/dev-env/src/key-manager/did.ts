/**
 * NOTE
 * This key manager service is not meant for production use.
 * It's specifically designed for the dev env.
 */

import * as didSdk from '@adxp/did-sdk'

// Assumes 1 NIST P-256 key
// JSON-LD info: https://w3c-ccg.github.io/di-ecdsa-secpr1-2019/
export const formatDidWeb = (
  did: string,
  publicKeyBase58: string,
): didSdk.DIDDocument => {
  const key = {
    id: `#key1`,
    type: 'EcdsaSecp256r1VerificationKey2019',
    controller: did,
    publicKeyBase58: publicKeyBase58,
  }
  return {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/ecdsa-2019/v1',
    ],
    id: did,
    verificationMethod: [key],
    assertionMethod: ['#key1'],
    authentication: ['#key1'],
    capabilityInvocation: ['#key1'],
    capabilityDelegation: ['#key1'],
    service: [],
  }
}
