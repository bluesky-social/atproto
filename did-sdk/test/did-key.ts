import test from 'ava'
import crypto from 'crypto'
import * as did from '../src/index.js'

const KEY_MULTIBASE = 'z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH'
const DID_KEY = `did:key:${KEY_MULTIBASE}`
const ed25519Key = {
  id: `${DID_KEY}#${KEY_MULTIBASE}`,
  type: 'Ed25519VerificationKey2018',
  controller: DID_KEY,
  publicKeyBase58: 'B12NYF8RrR3h41TDCTJojY59usg3mbtbjnFs7Eud1Y6u',
}
const x25519Key = {
  id: `${DID_KEY}#z6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc`,
  type: 'X25519KeyAgreementKey2019',
  controller: DID_KEY,
  publicKeyBase58: 'JhNWeSVLMYccCk7iopQW4guaSJTojqpMEELgSLhKwRr',
}

test('Resolve valid did:key', async (t) => {
  const didDoc = await did.resolve(DID_KEY)
  t.deepEqual(didDoc.didDoc, {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/ed25519-2018/v1',
      'https://w3id.org/security/suites/x25519-2019/v1',
    ],
    id: DID_KEY,
    verificationMethod: [ed25519Key, x25519Key],
    assertionMethod: [`${DID_KEY}#${KEY_MULTIBASE}`],
    authentication: [`${DID_KEY}#${KEY_MULTIBASE}`],
    capabilityInvocation: [`${DID_KEY}#${KEY_MULTIBASE}`],
    capabilityDelegation: [`${DID_KEY}#${KEY_MULTIBASE}`],
    keyAgreement: [
      `${DID_KEY}#z6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc`,
    ],
  })
  t.is(didDoc.getURI(), DID_KEY)
  t.throws(() => didDoc.getController())
  t.deepEqual(didDoc.listPublicKeys('assertionMethod'), [ed25519Key])
  t.deepEqual(didDoc.listPublicKeys('authentication'), [ed25519Key])
  t.deepEqual(didDoc.listPublicKeys('capabilityInvocation'), [ed25519Key])
  t.deepEqual(didDoc.listPublicKeys('capabilityDelegation'), [ed25519Key])
  t.deepEqual(didDoc.listPublicKeys('keyAgreement'), [x25519Key])
  t.deepEqual(didDoc.getPublicKey('assertionMethod'), ed25519Key)
  t.deepEqual(didDoc.getPublicKey('authentication'), ed25519Key)
  t.deepEqual(didDoc.getPublicKey('capabilityInvocation'), ed25519Key)
  t.deepEqual(didDoc.getPublicKey('capabilityDelegation'), ed25519Key)
  t.deepEqual(didDoc.getPublicKey('keyAgreement'), x25519Key)
  t.deepEqual(didDoc.listServices(), [])
})

test('Resolve throws on malformed did:keys', async (t) => {
  await t.throwsAsync(() => did.resolve(`did:key:asdf`))
  await t.throwsAsync(() => did.resolve(`did:key:`))
  await t.throwsAsync(() => did.resolve(``))
})

test('Create did:key', async (t) => {
  const didDoc = await did.key.create('ed25519', {
    secureRandom: () => crypto.randomBytes(32),
  })
  const didDoc2 = await did.resolve(didDoc.getURI())
  t.deepEqual(didDoc.didDoc, didDoc2.didDoc)
  t.is(didDoc.getURI(), didDoc2.getURI())
  t.throws(() => didDoc.getController())
  t.deepEqual(
    didDoc.listPublicKeys('assertionMethod'),
    didDoc2.listPublicKeys('assertionMethod'),
  )
  t.deepEqual(
    didDoc.listPublicKeys('authentication'),
    didDoc2.listPublicKeys('authentication'),
  )
  t.deepEqual(
    didDoc.listPublicKeys('capabilityInvocation'),
    didDoc2.listPublicKeys('capabilityInvocation'),
  )
  t.deepEqual(
    didDoc.listPublicKeys('capabilityDelegation'),
    didDoc2.listPublicKeys('capabilityDelegation'),
  )
  t.deepEqual(
    didDoc.listPublicKeys('keyAgreement'),
    didDoc2.listPublicKeys('keyAgreement'),
  )
  t.deepEqual(
    didDoc.getPublicKey('assertionMethod'),
    didDoc2.getPublicKey('assertionMethod'),
  )
  t.deepEqual(
    didDoc.getPublicKey('authentication'),
    didDoc2.getPublicKey('authentication'),
  )
  t.deepEqual(
    didDoc.getPublicKey('capabilityInvocation'),
    didDoc2.getPublicKey('capabilityInvocation'),
  )
  t.deepEqual(
    didDoc.getPublicKey('capabilityDelegation'),
    didDoc2.getPublicKey('capabilityDelegation'),
  )
  t.deepEqual(
    didDoc.getPublicKey('keyAgreement'),
    didDoc2.getPublicKey('keyAgreement'),
  )
  t.deepEqual(didDoc.listServices(), didDoc2.listServices())
})

test('Serialize and hydrate did:key', async (t) => {
  const didDoc = await did.key.create('ed25519', {
    secureRandom: () => crypto.randomBytes(32),
  })
  const state = JSON.stringify(didDoc.serialize(), null, 2)
  const didDoc2 = await did.key.inst(JSON.parse(state))
  t.deepEqual(didDoc.didDoc, didDoc2.didDoc)
  t.deepEqual(didDoc.keys, didDoc2.keys)
})
