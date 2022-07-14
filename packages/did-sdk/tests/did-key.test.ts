import * as did from '../src'

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

describe('did:key', () => {
  it('Resolve valid did:key', async () => {
    const didDoc = await did.resolve(DID_KEY)
    expect(didDoc.didDoc).toEqual({
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
    expect(didDoc.getURI()).toBe(DID_KEY)
    expect(() => didDoc.getController()).toThrow()
    expect(didDoc.listPublicKeys('assertionMethod')).toEqual([ed25519Key])
    expect(didDoc.listPublicKeys('authentication')).toEqual([ed25519Key])
    expect(didDoc.listPublicKeys('capabilityInvocation')).toEqual([ed25519Key])
    expect(didDoc.listPublicKeys('capabilityDelegation')).toEqual([ed25519Key])
    expect(didDoc.listPublicKeys('keyAgreement')).toEqual([x25519Key])
    expect(didDoc.getPublicKey('assertionMethod')).toEqual(ed25519Key)
    expect(didDoc.getPublicKey('authentication')).toEqual(ed25519Key)
    expect(didDoc.getPublicKey('capabilityInvocation')).toEqual(ed25519Key)
    expect(didDoc.getPublicKey('capabilityDelegation')).toEqual(ed25519Key)
    expect(didDoc.getPublicKey('keyAgreement')).toEqual(x25519Key)
    expect(didDoc.listServices()).toEqual([])
  })

  it('Resolve throws on malformed did:keys', async () => {
    await expect(() => did.resolve(`did:key:asdf`)).rejects.toThrow()
    await expect(() => did.resolve(`did:key:`)).rejects.toThrow()
    await expect(() => did.resolve(``)).rejects.toThrow()
  })

  it('Create did:key', async () => {
    const didDoc = await did.key.create('ed25519')
    const didDoc2 = await did.resolve(didDoc.getURI())
    expect(didDoc.didDoc).toEqual(didDoc2.didDoc)
    expect(didDoc.getURI()).toBe(didDoc2.getURI())
    expect(() => didDoc.getController()).toThrow()
    expect(didDoc.listPublicKeys('assertionMethod')).toEqual(
      didDoc2.listPublicKeys('assertionMethod'),
    )
    expect(didDoc.listPublicKeys('authentication')).toEqual(
      didDoc2.listPublicKeys('authentication'),
    )
    expect(didDoc.listPublicKeys('capabilityInvocation')).toEqual(
      didDoc2.listPublicKeys('capabilityInvocation'),
    )
    expect(didDoc.listPublicKeys('capabilityDelegation')).toEqual(
      didDoc2.listPublicKeys('capabilityDelegation'),
    )
    expect(didDoc.listPublicKeys('keyAgreement')).toEqual(
      didDoc2.listPublicKeys('keyAgreement'),
    )
    expect(didDoc.getPublicKey('assertionMethod')).toEqual(
      didDoc2.getPublicKey('assertionMethod'),
    )
    expect(didDoc.getPublicKey('authentication')).toEqual(
      didDoc2.getPublicKey('authentication'),
    )
    expect(didDoc.getPublicKey('capabilityInvocation')).toEqual(
      didDoc2.getPublicKey('capabilityInvocation'),
    )
    expect(didDoc.getPublicKey('capabilityDelegation')).toEqual(
      didDoc2.getPublicKey('capabilityDelegation'),
    )
    expect(didDoc.getPublicKey('keyAgreement')).toEqual(
      didDoc2.getPublicKey('keyAgreement'),
    )
    expect(didDoc.listServices()).toEqual(didDoc2.listServices())
  })

  it('Serialize and hydrate did:key', async () => {
    const didDoc = await did.key.create('ed25519')
    const state = JSON.stringify(didDoc.serialize(), null, 2)
    const didDoc2 = await did.key.inst(JSON.parse(state))
    expect(didDoc.didDoc).toEqual(didDoc2.didDoc)
    expect(didDoc.keys).toEqual(didDoc2.keys)
  })
})
