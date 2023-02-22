import * as uint8arrays from 'uint8arrays'
import * as crypto from '@atproto/crypto'
import * as t from './types'
import { ServerError } from '../server/error'

export const formatDidDoc = (data: t.DocumentData): t.DidDocument => {
  const context = ['https://www.w3.org/ns/did/v1']

  const signingKeyInfo = formatKeyAndContext(data.signingKey)
  if (!context.includes(signingKeyInfo.context)) {
    context.push(signingKeyInfo.context)
  }

  const alsoKnownAs = data.handles.map((h) => ensureHttpPrefix(h))
  const services: Service[] = []
  if (data.services.atpPds) {
    services.push({
      id: `#atpPds`,
      type: 'AtpPersonalDataServer',
      serviceEndpoint: ensureHttpPrefix(data.services.atpPds),
    })
  }

  return {
    '@context': context,
    id: data.did,
    alsoKnownAs: alsoKnownAs,
    verificationMethod: [
      {
        id: `#signingKey`,
        type: signingKeyInfo.type,
        controller: data.did,
        publicKeyMultibase: signingKeyInfo.publicKeyMultibase,
      },
    ],
    assertionMethod: [`#signingKey`],
    capabilityInvocation: [`#signingKey`],
    capabilityDelegation: [`#signingKey`],
    service: services,
  }
}

type Service = {
  id: string
  type: string
  serviceEndpoint: string
}

type KeyAndContext = {
  context: string
  type: string
  publicKeyMultibase
}

const formatKeyAndContext = (key: string): KeyAndContext => {
  let keyInfo
  try {
    keyInfo = crypto.parseDidKey(key)
  } catch (err) {
    throw new ServerError(400, `Could not parse did:key: ${err}`)
  }
  const { jwtAlg, keyBytes } = keyInfo

  if (jwtAlg === crypto.P256_JWT_ALG) {
    return {
      context: 'https://w3id.org/security/suites/ecdsa-2019/v1',
      type: 'EcdsaSecp256r1VerificationKey2019',
      publicKeyMultibase: `z${uint8arrays.toString(keyBytes, 'base58btc')}`,
    }
  } else if (jwtAlg === crypto.SECP256K1_JWT_ALG) {
    return {
      context: 'https://w3id.org/security/suites/secp256k1-2019/v1',
      type: 'EcdsaSecp256k1VerificationKey2019',
      publicKeyMultibase: `z${uint8arrays.toString(keyBytes, 'base58btc')}`,
    }
  }
  throw new ServerError(400, `Unsupported key type: ${jwtAlg}`)
}

export const ensureHttpPrefix = (str: string): string => {
  if (str.startsWith('http://') || str.startsWith('https://')) {
    return str
  }
  return `https://${str}`
}
